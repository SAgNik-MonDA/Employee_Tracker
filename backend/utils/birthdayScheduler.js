const cron = require("node-cron");
const User = require("../models/User");
const sendEmail = require("./sendEmail");

// Build the birthday HTML email
const buildBirthdayEmail = (name) => {
  const firstName = name.split(" ")[0];
  const year = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Happy Birthday!</title>
<style>
body{margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif}
.wrapper{max-width:600px;margin:0 auto;padding:32px 16px}
.card{background:linear-gradient(135deg,#1a1f2e 0%,#16213e 50%,#0f3460 100%);border-radius:24px;border:1px solid rgba(99,179,237,.2);overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.5)}
.hdr{background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);padding:48px 32px;text-align:center}
.hdr h1{margin:0;color:#fff;font-size:36px;font-weight:800}
.hdr p{margin:8px 0 0;color:rgba(255,255,255,.85);font-size:16px}
.bd{padding:40px 36px}
.greeting{font-size:22px;font-weight:700;color:#e2e8f0;margin:0 0 16px}
.msg{font-size:15px;color:#94a3b8;line-height:1.8;margin:0 0 28px}
.balloon{text-align:center;font-size:28px;letter-spacing:6px;margin:20px 0}
.hbox{background:linear-gradient(135deg,rgba(102,126,234,.15),rgba(118,75,162,.15));border:1px solid rgba(102,126,234,.3);border-radius:16px;padding:28px;margin:0 0 28px;text-align:center}
.hbox .big{font-size:48px;display:block;margin-bottom:12px}
.hbox p{margin:0;color:#cbd5e1;font-size:14px;line-height:1.7}
.wishes{display:flex;gap:12px;margin:0 0 28px}
.wish{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;text-align:center}
.wish .wi{font-size:24px;display:block;margin-bottom:6px}
.wish p{margin:0;color:#94a3b8;font-size:11px;line-height:1.5}
.divider{border:none;border-top:1px solid rgba(255,255,255,.07);margin:28px 0}
.cta{text-align:center}.cta p{color:#94a3b8;font-size:14px;line-height:1.6;margin:0}
.ftr{background:rgba(0,0,0,.3);padding:24px 36px;text-align:center}
.ftr p{margin:0;color:#475569;font-size:12px;line-height:1.6}
.sig{color:#475569;font-size:11px;margin-top:12px;font-style:italic}
</style>
</head>
<body>
<div class="wrapper"><div class="card">
<div class="hdr">
  <div style="font-size:40px;letter-spacing:8px;margin-bottom:12px">&#127881; &#127874; &#127882;</div>
  <h1>Happy Birthday!</h1>
  <p>Wishing you a wonderful day, ${firstName}!</p>
</div>
<div class="bd">
  <p class="greeting">Hey ${firstName}! &#127880;</p>
  <p class="msg">On behalf of the entire team at <strong style="color:#a78bfa">Employee Tracker</strong>, we want to wish you a very <strong style="color:#f0abfc">Happy Birthday!</strong> &#129395;<br/><br/>Today is your special day &mdash; a day to celebrate <em>you</em>. Your dedication, hard work, and positive energy make our workplace a better place every single day. We are truly grateful to have you on the team!</p>
  <div class="balloon">&#127880; &#127873; &#127775; &#127874; &#127880;</div>
  <div class="hbox">
    <span class="big">&#127775;</span>
    <p><strong style="color:#a78bfa">Another year wiser, stronger, and more amazing!</strong><br/><br/>May this birthday bring you joy, success, and everything you have been dreaming of. Here is to a fantastic year ahead full of growth and achievements! &#128640;</p>
  </div>
  <div class="wishes">
    <div class="wish"><span class="wi">&#128170;</span><p>Great<br/><strong style="color:#86efac">Health</strong></p></div>
    <div class="wish"><span class="wi">&#128176;</span><p>Abundant<br/><strong style="color:#fcd34d">Wealth</strong></p></div>
    <div class="wish"><span class="wi">&#128522;</span><p>Endless<br/><strong style="color:#f9a8d4">Happiness</strong></p></div>
    <div class="wish"><span class="wi">&#128640;</span><p>Career<br/><strong style="color:#93c5fd">Success</strong></p></div>
  </div>
  <hr class="divider"/>
  <div class="cta"><p>&#127882; Log in to your <strong style="color:#a78bfa">Employee Tracker</strong> profile today for a special birthday surprise waiting just for you! &#127882;</p></div>
</div>
<div class="ftr">
  <p>With love and warm wishes,<br/><strong style="color:#64748b">The Employee Tracker Team &#10084;&#65039;</strong></p>
  <p class="sig">Automated birthday greeting sent on ${dateStr}.<br/>You are receiving this as a valued member of our team.<br/>&copy; ${year} Employee Tracker. All rights reserved.</p>
</div>
</div></div>
</body>
</html>`;
  return html;
};

// Find employees with today's birthday and send emails (strictly once per year)
const sendBirthdayEmails = async () => {
  try {
    const now         = new Date();
    const currentYear = now.getFullYear();
    const month       = now.getMonth() + 1;
    const day         = now.getDate();
    console.log("[Birthday Scheduler] Checking birthdays for day=" + day + " month=" + month + " year=" + currentYear);

    const allEmployees = await User.find({ dateOfBirth: { $ne: null } })
      .select("name email dateOfBirth lastBirthdayEmailYear");

    const todayBirthdays = allEmployees.filter((emp) => {
      if (!emp.dateOfBirth) return false;
      const dob = new Date(emp.dateOfBirth);
      const isToday = dob.getDate() === day && (dob.getMonth() + 1) === month;
      const alreadySentThisYear = emp.lastBirthdayEmailYear === currentYear;
      return isToday && !alreadySentThisYear;
    });

    if (todayBirthdays.length === 0) {
      console.log("[Birthday Scheduler] No unsent birthdays today.");
      return;
    }

    console.log("[Birthday Scheduler] Found " + todayBirthdays.length + " unsent birthday(s) today!");

    const results = await Promise.allSettled(
      todayBirthdays.map((emp) =>
        sendEmail({
          to:      emp.email,
          subject: "Happy Birthday, " + emp.name.split(" ")[0] + "! Wishing you an amazing day!",
          html:    buildBirthdayEmail(emp.name),
        })
      )
    );

    for (let idx = 0; idx < results.length; idx++) {
      const result = results[idx];
      const emp = todayBirthdays[idx];
      if (result.status === "fulfilled" && result.value) {
        console.log("Birthday email sent to " + emp.name + " <" + emp.email + ">");
        // Record that birthday email was sent for this year
        await User.findByIdAndUpdate(emp._id, { lastBirthdayEmailYear: currentYear }).catch(() => {});
      } else {
        console.error("Failed for " + emp.name + ": " + (result.reason ? result.reason.message : "Unknown"));
      }
    }
  } catch (err) {
    console.error("[Birthday Scheduler] Error: " + err.message);
  }
};


// Register the cron job — runs daily at 12:00 AM Midnight IST (00:00 IST) right as the birthday starts
const startBirthdayScheduler = () => {
  cron.schedule("0 0 * * *", sendBirthdayEmails, {
    scheduled: true,
    timezone:  "Asia/Kolkata",
  });
  console.log("[Birthday Scheduler] Started — runs daily at 12:00 AM Midnight IST (00:00 IST)");

  // Run immediately on server start to ensure today's birthdays are sent
  sendBirthdayEmails();
};

module.exports = { startBirthdayScheduler, sendBirthdayEmails };



const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const Performance = require('../models/Performance');
const Meeting = require('../models/Meeting');
const Team = require('../models/Team');
const sendEmail = require('./sendEmail');

/**
 * DAILY SUBSCRIPTION LIFECYCLE & AUTO-PURGE SCHEDULER
 * Runs every day at 00:05 AM IST (18:35 UTC)
 */
const checkSubscriptionsLifecycle = async () => {
  console.log('⏰ [Subscription Scheduler] Running daily enterprise subscription evaluation...');
  try {
    const subscriptions = await Subscription.find({ isPurged: false });
    const now = Date.now();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    for (const sub of subscriptions) {
      const diffTime = new Date(sub.endDate).getTime() - now;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // ─────────────────────────────────────────────────────────────────────────
      // 1. WARNING: 5 DAYS BEFORE EXPIRATION
      // ─────────────────────────────────────────────────────────────────────────
      if (daysRemaining <= 5 && daysRemaining > 0 && sub.status !== 'expiring_soon') {
        sub.status = 'expiring_soon';
        sub.lastNotifiedAt = new Date();
        await sub.save();

        console.log(`⚠️ Subscription for ${sub.companyName} (${sub.adminEmail}) expires in ${daysRemaining} days. Dispatching email notice.`);

        sendEmail({
          to: sub.adminEmail,
          subject: `⚠️ Urgent: Your Employee Tracker Subscription Expires in ${daysRemaining} Days`,
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#08252b;color:#f1f5f9;border-radius:16px;overflow:hidden;border:1px solid #14b8a6;">
              <div style="background:linear-gradient(135deg,#0d9488,#042f2e);padding:30px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:0.5px;">SUBSCRIPTION RENEWAL REMINDER</h1>
                <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;font-weight:600;">Action Required: ${daysRemaining} Days Left</p>
              </div>
              <div style="padding:32px 28px;">
                <p style="font-size:16px;color:#e2e8f0;margin-top:0;">Dear <strong>${sub.adminName}</strong>,</p>
                <p style="font-size:14px;color:#94a3b8;line-height:1.6;">
                  Your enterprise subscription for <strong>${sub.companyName}</strong> (<em>${sub.planName}</em>) is scheduled to expire on <strong>${new Date(sub.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>.
                </p>
                <div style="background:#0b1920;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:8px;margin:22px 0;">
                  <p style="margin:0;color:#fcd34d;font-size:13px;font-weight:600;">
                    🛡️ Seamless Continuity Guarantee:
                  </p>
                  <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;line-height:1.5;">
                    Renewing now extends your active period seamlessly without any interruption or data loss. All employee biometric records, attendance logs, and payroll structures remain intact.
                  </p>
                </div>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${frontendUrl}/admin/dashboard" style="display:inline-block;background:linear-gradient(135deg,#10b981,#0d9488);color:#ffffff;padding:14px 34px;border-radius:12px;font-weight:bold;text-decoration:none;font-size:15px;box-shadow:0 8px 20px rgba(16,185,129,0.3);">
                    ⚡ Renew Subscription Now &rarr;
                  </a>
                </div>
                <p style="font-size:12px;color:#64748b;line-height:1.5;margin-bottom:0;">
                  If you have already renewed, please disregard this automated notice.
                </p>
              </div>
            </div>
          `,
        }).catch((e) => console.error('Subscription reminder email error:', e.message));
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 2. GRACE PERIOD (0 TO 5 DAYS OVERDUE)
      // ─────────────────────────────────────────────────────────────────────────
      else if (daysRemaining <= 0 && daysRemaining >= -5 && sub.status !== 'grace_period') {
        sub.status = 'grace_period';
        await sub.save();
        console.log(`⏰ Subscription for ${sub.companyName} entered 5-day grace period.`);
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 3. EXPIRED & ACCESS LOCKED OUT (OVERDUE > 5 DAYS)
      // ─────────────────────────────────────────────────────────────────────────
      else if (daysRemaining < -5 && daysRemaining >= -30 && sub.status !== 'expired') {
        sub.status = 'expired';
        await sub.save();
        console.log(`🔒 Subscription for ${sub.companyName} is EXPIRED. Team access locked out.`);
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 4. AUTOMATIC DATA PURGE (OVERDUE > 30 DAYS / 1 MONTH)
      // ─────────────────────────────────────────────────────────────────────────
      else if (daysRemaining < -30 && !sub.isPurged) {
        console.log(`🚨 [Data Purge] Subscription for ${sub.companyName} has been expired for > 30 days. Purging corporate tenant data...`);

        try {
          const companyId = sub.companyId;

          // Find all users belonging to this company
          const companyUsers = await User.find({
            $or: [{ companyId }, { _id: companyId }],
            role: { $ne: 'SuperAdmin' }, // protect root superadmin
          });
          const userIds = companyUsers.map((u) => u._id);

          if (userIds.length > 0 || companyId) {
            const EmployeeRequest = require('../models/EmployeeRequest');
            const ShiftSchedule = require('../models/ShiftSchedule');
            const WithdrawalRequest = require('../models/WithdrawalRequest');
            const SalaryStructure = require('../models/SalaryStructure');
            const LeaveConfig = require('../models/LeaveConfig');
            const FaceResetLog = require('../models/FaceResetLog');
            const Notification = require('../models/Notification');
            const TeamHistory = require('../models/TeamHistory');
            const TeamChat = require('../models/TeamChat');
            const SystemSettings = require('../models/SystemSettings');

            await Promise.all([
              Attendance.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              Leave.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              Payroll.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              Performance.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              Meeting.deleteMany({ $or: [{ companyId }, { createdBy: { $in: userIds } }] }),
              Team.deleteMany({ $or: [{ companyId }, { createdBy: { $in: userIds } }] }),
              TeamHistory.deleteMany({ companyId }),
              TeamChat.deleteMany({ $or: [{ companyId }, { senderId: { $in: userIds } }] }),
              EmployeeRequest.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              ShiftSchedule.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              WithdrawalRequest.deleteMany({ $or: [{ companyId }, { employeeId: { $in: userIds } }] }),
              SalaryStructure.deleteMany({ companyId }),
              LeaveConfig.deleteMany({ companyId }),
              FaceResetLog.deleteMany({ $or: [{ companyId }, { employee: { $in: userIds } }] }),
              Notification.deleteMany({ $or: [{ companyId }, { userId: { $in: userIds } }] }),
              SystemSettings.deleteMany({ key: `ACTIVE_LEAVE_YEAR_${String(companyId)}` }),
            ]);

            if (userIds.length > 0) {
              await User.deleteMany({ _id: { $in: userIds } });
            }
            console.log(`🗑️ Successfully purged ${userIds.length} users and all tenant records for ${sub.companyName}.`);
          }

          sub.isPurged = true;
          sub.purgedAt = new Date();
          sub.status = 'expired';
          await sub.save();
        } catch (purgeErr) {
          console.error(`❌ Data purge failed for company ${sub.companyName}:`, purgeErr);
        }
      }
    }
  } catch (error) {
    console.error('❌ Subscription Lifecycle Evaluation Error:', error);
  }
};

const startSubscriptionScheduler = () => {
  // Runs every day at 00:05 AM IST
  cron.schedule('5 0 * * *', () => {
    checkSubscriptionsLifecycle();
  });

  // Also run an immediate check on startup
  setTimeout(() => {
    checkSubscriptionsLifecycle();
  }, 10000);

  console.log('✅ Subscription Lifecycle & Auto-Purge Scheduler initialized (Daily 00:05 AM IST)');
};

module.exports = { startSubscriptionScheduler, checkSubscriptionsLifecycle };

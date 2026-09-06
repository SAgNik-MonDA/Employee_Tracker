const cron = require("node-cron");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Runs daily at 12:00 AM Midnight IST (00:00 IST)
const clearExpiredHolidaysAndNotify = async () => {
  try {
    const now = new Date();
    
    // Find users whose holidayValidUntil is in the past
    const expiredUsers = await User.find({
      holidayValidUntil: { $lt: now, $ne: null }
    });

    if (expiredUsers.length === 0) return;

    // Reset their holidays but AUTO-ADVANCE the start and end dates by 7 days
    const bulkOps = expiredUsers.map(u => {
      const oldStart = new Date(u.holidayStartDate);
      const newStart = new Date(oldStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const newValidUntil = new Date(newStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      newValidUntil.setHours(23, 59, 59, 999);

      return {
        updateOne: {
          filter: { _id: u._id },
          update: { 
            $set: { 
              weeklyHolidays: [], 
              holidayStartDate: newStart,
              holidayValidUntil: newValidUntil
            } 
          }
        }
      };
    });

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }

    const adminsAndHR = await User.find({ role: { $in: ['Admin', 'HR'] } }).select('_id');
    
    if (adminsAndHR.length > 0) {
      if (expiredUsers.length > 0) {
        const expiredNames = expiredUsers.map(u => u.name).join(', ');
        
        const notifications = adminsAndHR.map(admin => ({
          userId: admin._id,
          title: 'Holidays Expired - Action Required',
          message: `The weekly holidays for ${expiredUsers.length} employee(s) (${expiredNames}) have expired and been reset. Please set their new weekly holidays.`,
          type: 'warning',
          link: '/admin/holidays'
        }));

        await Notification.insertMany(notifications).catch(() => {});
      }
      
      // Check for reminders (6th day, i.e. validUntil is tomorrow)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      
      const remindingUsers = await User.find({
        holidayValidUntil: { $gt: tomorrow, $lte: dayAfter }
      });
      
      if (remindingUsers.length > 0) {
        const remindingNames = remindingUsers.map(u => u.name).join(', ');
        
        const reminders = adminsAndHR.map(admin => ({
          userId: admin._id,
          title: 'Holiday Reset Reminder',
          message: `The weekly holidays for ${remindingUsers.length} employee(s) (${remindingNames}) will expire tomorrow. Please review and update their schedules soon.`,
          type: 'info',
          link: '/admin/holidays'
        }));

        await Notification.insertMany(reminders).catch(() => {});
      }
    }

  } catch (error) {
    console.error("[Holiday Scheduler] Error processing expired holidays:", error);
  }
};

const startHolidayScheduler = () => {
  // Run daily at midnight IST
  cron.schedule("0 0 * * *", clearExpiredHolidaysAndNotify, {
    scheduled: true,
    timezone: "Asia/Kolkata",
  });
  console.log("[Holiday Scheduler] Started \u2014 runs daily at 12:00 AM IST to clear expired holidays");
};

module.exports = startHolidayScheduler;

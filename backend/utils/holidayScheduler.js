const cron = require('node-cron');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getTenantId, getTenantAdmins } = require('./tenantHelper');

// Runs daily at 12:00 AM Midnight IST (00:00 IST) — strictly scoped per company tenant
const clearExpiredHolidaysAndNotify = async () => {
  try {
    const now = new Date();

    const expiredUsers = await User.find({
      holidayValidUntil: { $lt: now, $ne: null },
      role: { $ne: 'SuperAdmin' },
      isDeleted: { $ne: true },
    });

    if (expiredUsers.length > 0) {
      const bulkOps = expiredUsers.map((u) => {
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
                holidayValidUntil: newValidUntil,
              },
            },
          },
        };
      });

      await User.bulkWrite(bulkOps);

      // Group expired users by their company tenant so admins ONLY receive alerts for their own staff
      const expiredByTenant = {};
      expiredUsers.forEach((u) => {
        const tId = String(getTenantId(u));
        if (!expiredByTenant[tId]) expiredByTenant[tId] = [];
        expiredByTenant[tId].push(u);
      });

      for (const [tenantId, tenantUsers] of Object.entries(expiredByTenant)) {
        const adminsAndHR = await getTenantAdmins(tenantId);
        if (adminsAndHR.length === 0) continue;
        const expiredNames = tenantUsers.map((u) => u.name).join(', ');
        const notifications = adminsAndHR.map((admin) => ({
          companyId: tenantId,
          userId: admin._id,
          title: 'Holidays Expired - Action Required',
          message: `The weekly holidays for ${tenantUsers.length} employee(s) (${expiredNames}) have expired and been reset. Please set their new weekly holidays.`,
          type: 'warning',
          link: '/admin/holidays',
        }));
        await Notification.insertMany(notifications).catch(() => {});
      }
    }

    // Check for reminders (validUntil is tomorrow) grouped strictly per company tenant
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const remindingUsers = await User.find({
      holidayValidUntil: { $gt: tomorrow, $lte: dayAfter },
      role: { $ne: 'SuperAdmin' },
      isDeleted: { $ne: true },
    });

    if (remindingUsers.length > 0) {
      const remindingByTenant = {};
      remindingUsers.forEach((u) => {
        const tId = String(getTenantId(u));
        if (!remindingByTenant[tId]) remindingByTenant[tId] = [];
        remindingByTenant[tId].push(u);
      });

      for (const [tenantId, tenantUsers] of Object.entries(remindingByTenant)) {
        const adminsAndHR = await getTenantAdmins(tenantId);
        if (adminsAndHR.length === 0) continue;
        const remindingNames = tenantUsers.map((u) => u.name).join(', ');
        const reminders = adminsAndHR.map((admin) => ({
          companyId: tenantId,
          userId: admin._id,
          title: 'Holiday Reset Reminder',
          message: `The weekly holidays for ${tenantUsers.length} employee(s) (${remindingNames}) will expire tomorrow. Please review and update their schedules soon.`,
          type: 'info',
          link: '/admin/holidays',
        }));
        await Notification.insertMany(reminders).catch(() => {});
      }
    }
  } catch (error) {
    console.error('[Holiday Scheduler] Error processing expired holidays:', error);
  }
};

const startHolidayScheduler = () => {
  cron.schedule('0 0 * * *', clearExpiredHolidaysAndNotify, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });
  console.log('[Holiday Scheduler] Started — runs daily at 12:00 AM IST to clear expired holidays');
};

module.exports = startHolidayScheduler;

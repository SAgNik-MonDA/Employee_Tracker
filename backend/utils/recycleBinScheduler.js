const cron = require('node-cron');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Payroll = require('../models/Payroll');
const Performance = require('../models/Performance');
const Meeting = require('../models/Meeting');
const Team = require('../models/Team');
const TeamChat = require('../models/TeamChat');
const TeamHistory = require('../models/TeamHistory');
const EmployeeRequest = require('../models/EmployeeRequest');
const ShiftSchedule = require('../models/ShiftSchedule');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const SalaryStructure = require('../models/SalaryStructure');
const LeaveConfig = require('../models/LeaveConfig');
const FaceResetLog = require('../models/FaceResetLog');
const Notification = require('../models/Notification');
const Subscription = require('../models/Subscription');
const SystemSettings = require('../models/SystemSettings');
const { cloudinary } = require('../config/cloudinary');

const RECYCLE_BIN_RETENTION_DAYS = 30;

const getCloudinaryPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const afterUpload = parts[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[^.]+$/, '');
  } catch {
    return null;
  }
};

const destroyCloudinaryAvatarIfExists = async (profilePicture) => {
  const publicId = getCloudinaryPublicId(profilePicture);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[RecycleBin] Cloudinary avatar cleanup skipped:', err.message);
  }
};

/**
 * Permanently deletes a single non-Admin user from Recycle Bin and cascades
 * cleanup across all employee-linked collections.
 */
const permanentlyPurgeEmployee = async (userDoc) => {
  if (!userDoc) return;
  if (userDoc.role === 'Admin' || userDoc.role === 'SuperAdmin') {
    throw new Error('Admin and SuperAdmin accounts cannot be deleted via Recycle Bin purge');
  }

  await destroyCloudinaryAvatarIfExists(userDoc.profilePicture);

  const empId = userDoc._id;
  await Promise.all([
    Attendance.deleteMany({ employeeId: empId }),
    Leave.deleteMany({ employeeId: empId }),
    Payroll.deleteMany({ employeeId: empId }),
    Performance.deleteMany({ employeeId: empId }),
    EmployeeRequest.deleteMany({ employeeId: empId }),
    ShiftSchedule.deleteMany({ employeeId: empId }),
    WithdrawalRequest.deleteMany({ employeeId: empId }),
    FaceResetLog.deleteMany({ employee: empId }),
    Notification.deleteMany({ userId: empId }),
    TeamChat.deleteMany({ senderId: empId }),
    Team.updateMany({ members: empId }, { $pull: { members: empId } }),
    Team.updateMany({ teamLead: empId }, { $set: { teamLead: null } }),
    Meeting.updateMany({ attendees: empId }, { $pull: { attendees: empId } }),
  ]);

  await User.findByIdAndDelete(empId);
};

/**
 * Permanently deletes an entire organization tenant when the sole remaining Admin
 * deletes their own Admin account, preserving platform SuperAdmin accounts.
 */
const purgeTenantOrganization = async (tenantId) => {
  if (!tenantId) return;

  const companyUsers = await User.find({
    $or: [{ companyId: tenantId }, { _id: tenantId }],
    role: { $ne: 'SuperAdmin' },
  }).select('_id profilePicture');

  await Promise.all(
    companyUsers.map((u) => destroyCloudinaryAvatarIfExists(u.profilePicture))
  );

  const userIds = companyUsers.map((u) => u._id);

  await Promise.all([
    Attendance.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    Leave.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    Payroll.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    Performance.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    Meeting.deleteMany({ $or: [{ companyId: tenantId }, { createdBy: { $in: userIds } }] }),
    Team.deleteMany({ $or: [{ companyId: tenantId }, { createdBy: { $in: userIds } }] }),
    TeamHistory.deleteMany({ companyId: tenantId }),
    TeamChat.deleteMany({ $or: [{ companyId: tenantId }, { senderId: { $in: userIds } }] }),
    EmployeeRequest.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    ShiftSchedule.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    WithdrawalRequest.deleteMany({ $or: [{ companyId: tenantId }, { employeeId: { $in: userIds } }] }),
    SalaryStructure.deleteMany({ companyId: tenantId }),
    LeaveConfig.deleteMany({ companyId: tenantId }),
    FaceResetLog.deleteMany({ $or: [{ companyId: tenantId }, { employee: { $in: userIds } }] }),
    Notification.deleteMany({ $or: [{ companyId: tenantId }, { userId: { $in: userIds } }] }),
    SystemSettings.deleteMany({ key: `ACTIVE_LEAVE_YEAR_${String(tenantId)}` }),
    Subscription.updateMany(
      { companyId: tenantId, isPurged: false },
      { $set: { isPurged: true, purgedAt: new Date(), status: 'expired' } }
    ),
  ]);

  if (userIds.length > 0) {
    await User.deleteMany({ _id: { $in: userIds }, role: { $ne: 'SuperAdmin' } });
  }
};

/**
 * Finds and permanently deletes any soft-deleted non-Admin employees whose 30-day
 * Recycle Bin retention period has expired.
 */
const purgeExpiredRecycleBinEmployees = async () => {
  try {
    const now = new Date();
    const fallbackCutoff = new Date(
      now.getTime() - RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const expiredUsers = await User.find({
      isDeleted: true,
      role: { $nin: ['Admin', 'SuperAdmin'] },
      $or: [
        { scheduledPurgeAt: { $lte: now } },
        { scheduledPurgeAt: null, deletedAt: { $lte: fallbackCutoff } },
      ],
    });

    if (expiredUsers.length === 0) return 0;

    let purgedCount = 0;
    for (const emp of expiredUsers) {
      try {
        await permanentlyPurgeEmployee(emp);
        purgedCount++;
        console.log(
          `🗑️ [Recycle Bin Purge] Permanently deleted ${emp.name} (${emp.email}) after 30-day retention.`
        );
      } catch (err) {
        console.error(
          `❌ [Recycle Bin Purge] Failed for ${emp._id}:`,
          err.message
        );
      }
    }
    return purgedCount;
  } catch (error) {
    console.error('❌ [Recycle Bin Scheduler] Error:', error.message);
    return 0;
  }
};

const startRecycleBinScheduler = () => {
  // Run hourly at minute 10 (IST) so expired 30-day Recycle Bin entries purge promptly
  cron.schedule(
    '10 * * * *',
    () => {
      purgeExpiredRecycleBinEmployees();
    },
    { scheduled: true, timezone: 'Asia/Kolkata' }
  );

  // Run shortly after server startup
  setTimeout(() => {
    purgeExpiredRecycleBinEmployees();
  }, 8000);

  console.log(
    `✅ Recycle Bin 30-Day Auto-Purge Scheduler initialized (Hourly at :10, retention=${RECYCLE_BIN_RETENTION_DAYS}d)`
  );
};

module.exports = {
  RECYCLE_BIN_RETENTION_DAYS,
  permanentlyPurgeEmployee,
  purgeTenantOrganization,
  purgeExpiredRecycleBinEmployees,
  startRecycleBinScheduler,
  destroyCloudinaryAvatarIfExists,
};

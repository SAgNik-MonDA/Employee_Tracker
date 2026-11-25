const User = require('../models/User');

/**
 * Resolves the canonical company tenant ObjectId for any authenticated user.
 * - For Company Admins (`role === 'Admin'` with `companyId === null`), returns `user._id`.
 * - For all company staff / admins created under a tenant, returns `user.companyId || user._id`.
 * - Returns null for platform SuperAdmin (who has zero tenant data access).
 */
const getTenantId = (user) => {
  if (!user || user.role === 'SuperAdmin') return null;
  return user.companyId || user._id;
};

/**
 * MongoDB query filter matching ALL active users belonging strictly to the caller's company.
 * Explicitly excludes SuperAdmin, soft-deleted (Recycle Bin) users, and legacy companyId:null leaks.
 */
const getTenantUserFilter = (tenantId) => ({
  $or: [{ companyId: tenantId }, { _id: tenantId }],
  role: { $ne: 'SuperAdmin' },
  isDeleted: { $ne: true },
});

/**
 * MongoDB query filter matching soft-deleted (Recycle Bin) non-Admin employees within a tenant.
 */
const getTenantRecycleBinFilter = (tenantId) => ({
  $or: [{ companyId: tenantId }, { _id: tenantId }],
  role: { $nin: ['Admin', 'SuperAdmin'] },
  isDeleted: true,
});

/**
 * Checks whether a target document or user belongs strictly to `tenantId`.
 */
const belongsToTenant = (docOrUser, tenantId) => {
  if (!docOrUser || !tenantId) return false;
  const docTenant = docOrUser.companyId
    ? docOrUser.companyId.toString()
    : (docOrUser._id ? docOrUser._id.toString() : null);
  return docTenant === tenantId.toString();
};

/**
 * Fetches distinct user ObjectIds belonging strictly to `tenantId`.
 */
const getTenantEmployeeIds = async (tenantId) => {
  if (!tenantId) return [];
  return User.find(getTenantUserFilter(tenantId)).distinct('_id');
};

/**
 * Builds a tenant-scoped query for models linked by both `companyId` and `employeeId`
 * so legacy migrated rows and new rows are matched strictly within `tenantId`.
 */
const buildTenantRecordFilter = (tenantId, baseFilter = {}) => ({
  ...baseFilter,
  companyId: tenantId,
});

/**
 * Returns admin/HR user documents belonging ONLY to `tenantId`.
 */
const getTenantAdmins = async (tenantId, extraCriteria = { role: { $in: ['Admin', 'HR'] } }, select = '_id') => {
  if (!tenantId) return [];
  return User.find({
    $and: [
      { $or: [{ companyId: tenantId }, { _id: tenantId }] },
      { role: { $ne: 'SuperAdmin' } },
      { isDeleted: { $ne: true } },
      extraCriteria,
    ],
  }).select(select);
};

module.exports = {
  getTenantId,
  getTenantUserFilter,
  getTenantRecycleBinFilter,
  belongsToTenant,
  getTenantEmployeeIds,
  buildTenantRecordFilter,
  getTenantAdmins,
};

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { getTenantId } = require('../utils/tenantHelper');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_employeetracker_2026');
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      req.tenantId = getTenantId(req.user);

      // Check subscription enforcement if user is NOT SuperAdmin
      if (req.user.role !== 'SuperAdmin') {
        const urlPath = req.originalUrl || req.url || '';
        const isExempt = urlPath.includes('/api/subscription/my-status') || 
                        urlPath.includes('/api/subscription/renew') ||
                        urlPath.includes('/api/auth/profile') ||
                        urlPath.includes('/api/auth/my-profile');

        if (!isExempt) {
          const companyId = req.user.companyId || req.user._id;
          const sub = await Subscription.findOne({ companyId }).sort({ createdAt: -1 });

          // If subscription exists and is expired beyond 5-day grace period
          if (sub) {
            const now = Date.now();
            const diffTime = new Date(sub.endDate).getTime() - now;
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysRemaining < -5) {
              return res.status(403).json({
                subscriptionExpired: true,
                message: 'Your organization subscription has expired. Please contact your company administrator to renew.',
              });
            }
          }
        }
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (roles.includes('SuperAdmin')) {
      if (req.user.role === 'SuperAdmin') return next();
      return res.status(403).json({ message: 'SuperAdmin privilege required' });
    }

    if (req.user.role === 'SuperAdmin') {
      return res.status(403).json({ message: 'SuperAdmin cannot access company private data' });
    }

    // Admin always has full access to tenant routes
    if (req.user.role === 'Admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }
    next();
  };
};

module.exports = { protect, authorize };

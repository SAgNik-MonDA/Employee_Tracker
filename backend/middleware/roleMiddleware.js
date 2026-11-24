const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // If route specifically requires SuperAdmin, ONLY SuperAdmin is permitted
    if (roles.includes('SuperAdmin')) {
      if (req.user.role === 'SuperAdmin') {
        return next();
      }
      return res.status(403).json({
        message: 'Access denied. SuperAdmin privileges required.',
      });
    }

    // SuperAdmin cannot access regular company tenant operational routes (strict data isolation)
    if (req.user.role === 'SuperAdmin') {
      return res.status(403).json({
        message: 'Access denied. SuperAdmin cannot access company tenant operational data.',
      });
    }

    // Admin has access to all tenant administrative routes
    if (req.user.role === 'Admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };

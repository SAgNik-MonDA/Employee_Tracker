const User = require('../models/User');

const seedSuperAdmin = async () => {
  try {
    const existing = await User.findOne({ role: 'SuperAdmin' });
    if (!existing) {
      const superAdmin = await User.create({
        name: 'System SuperAdmin',
        email: 'superadmin@employeetracker.com',
        password: 'SuperAdmin@2026',
        role: 'SuperAdmin',
        employeeCode: 'SUPERADMIN',
        designation: 'Platform Super Administrator',
        department: 'Platform Governance',
        phone: '+91 9876543210',
        companyName: 'Employee Tracker Core',
      });
      console.log('👑 [SuperAdmin Seed] Default SuperAdmin account created: superadmin@employeetracker.com / SuperAdmin@2026');
    } else {
      console.log('👑 [SuperAdmin Seed] SuperAdmin account verified.');
    }
  } catch (error) {
    console.error('❌ SuperAdmin Seed Error:', error.message);
  }
};

module.exports = seedSuperAdmin;

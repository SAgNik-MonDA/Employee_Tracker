const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const connectDB = require('./config/db');

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminExists = await User.findOne({ role: 'Admin' });
    if (adminExists) {
      console.log('⚠️  Admin user already exists:', adminExists.email);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Admin',
      email: 'admin@company.com',
      password: 'admin123',
      role: 'Admin',
      employeeCode: 'ADMIN',
      designation: 'System Administrator',
      department: 'IT',
      basicSalary: 0,
    });

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: admin123`);
    console.log('   ⚠️  Please change the password after first login!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error.message);
    process.exit(1);
  }
};

seedAdmin();

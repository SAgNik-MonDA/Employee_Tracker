const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: [
        'Admin', 'HR', 'Employee',
        'Project Manager', 'Project Lead', 'General Manager',
        'CEO', 'CTO', 'CIO', 'CISO', 'COO',
        'Frontend Engineer', 'Backend Engineer', 'Full-Stack Engineer', 'Mobile Developer', 'QA Engineer',
        'DevOps Engineer', 'Product Manager', 'UI Designer', 'UX Designer', 'Technical Writer',
        'Data Analyst', 'Data Scientist', 'Data Engineer', 'AI/ML Engineer', 'Cloud Architect',
        'System Administrator', 'Network Engineer', 'Database Administrator', 'Security Analyst',
        'Penetration Tester', 'Incident Responder', 'Sales Engineer', 'Account Manager', 'Customer Success Manager',
        'Technical Support Specialist', 'Chief Marketing Officer', 'Director / Head of Marketing',
        'Product Marketing Manager', 'Technical Product Marketer', 'Demand Generation Manager',
        'Email Marketing Specialist', 'Growth Marketer / Hacker', 'Paid Media Specialist (PPC)',
        'Content Marketing Manager', 'Technical Copywriter', 'SEO Specialist', 'Social Media Manager',
        'PR / Communications Manager', 'Marketing Operations (MOPs) Manager',
        'Implementation / Onboarding Specialist', 'IT Project Manager',
        'IT Consultant / Business Analyst', 'Technical Support Engineer', 'Payroll Manager',
        'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)'
      ],
      default: 'Employee',
    },
    employeeCode: {
      type: String,
      default: '',
      trim: true,
    },
    designation: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    alternatePhone: {
      type: String,
      default: '',
      trim: true,
    },
    permanentAddress: {
      type: String,
      default: '',
    },
    currentAddress: {
      type: String,
      default: '',
    },
    bankDetails: {
      bankName:          { type: String, default: '' },
      branchName:        { type: String, default: '' },
      ifscCode:          { type: String, default: '' },
      bankAddress:       { type: String, default: '' },
      accountHolderName: { type: String, default: '' },
      accountNumber:     { type: String, default: '' },
    },
    basicSalary: {
      type: Number,
      default: 0,
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    profilePicture: {
      type: String,
      default: '',
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    lastBirthdayEmailYear: {
      type: Number,
      default: null,
    },

    // Weekly off days — max 2 (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    weeklyHolidays: {
      type: [Number],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 2 && arr.every((d) => d >= 0 && d <= 6),
        message: 'Maximum 2 holiday days allowed, each between 0 (Sun) and 6 (Sat)',
      },
    },
    holidayStartDate: {
      type: Date,
      default: null,
    },
    holidayValidUntil: {
      type: Date,
      default: null,
    },
    faceDescriptor: {
      type: [Number],
      default: [],
    },
    faceResetRequest: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected'],
      default: 'None'
    },

    // Forgot-password flow

    resetPasswordToken: {
      type: String,
      default: undefined,
    },
    resetPasswordExpire: {
      type: Date,
      default: undefined,
    },
  },
  { timestamps: true }
);

// Hash password before saving (only when modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate & hash password-reset token (valid 20 min)
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken  = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 20 * 60 * 1000; // 20 minutes
  return resetToken; // send the raw token in the email link
};

module.exports = mongoose.model('User', userSchema);

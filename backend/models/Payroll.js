const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    monthYear: {
      type: String, // MM-YYYY
      required: true,
    },
    baseSalary: {
      type: Number,
      required: true,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    pfDeduction: {
      type: Number,
      default: 0,
    },
    mediclaimDeduction: {
      type: Number,
      default: 0,
    },
    leaveDeduction: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    totalDaysInMonth: {
      type: Number,
      default: 30,
    },
    effectiveDays: {
      type: Number,
      default: 30,
    },
    status: {
      type: String,
      enum: ['Paid', 'Unpaid', 'Pending'],
      default: 'Unpaid',
    },
  },
  { timestamps: true }
);

// One payroll record per employee per month
payrollSchema.index({ employeeId: 1, monthYear: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);

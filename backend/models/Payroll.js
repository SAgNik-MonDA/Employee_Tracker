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
    type: {
      type: String,
      enum: ['Regular', 'Withdrawal'],
      default: 'Regular',
    },
    baseSalary: {
      type: Number,
      required: true,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    bonusReason: {
      type: String,
      default: '',
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
    inactiveCount: {
      type: Number,
      default: 0,
    },
    inactiveDeduction: {
      type: Number,
      default: 0,
    },
    yearlyUnapprovedAbsences: {
      type: Number,
      default: 0,
    },
    unapprovedAbsenceDeduction: {
      type: Number,
      default: 0,
    },
    postAbsenceApprovedLeaves: {
      type: Number,
      default: 0,
    },
    postAbsenceApprovedDeduction: {
      type: Number,
      default: 0,
    },
    postAbsenceRejectedLeaves: {
      type: Number,
      default: 0,
    },
    postAbsenceRejectedDeduction: {
      type: Number,
      default: 0,
    },
    penaltyDeductions: {
      type: Number,
      default: 0,
    },
    deductionBreakdownNotes: {
      type: [String],
      default: [],
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

// One payroll record per employee per month per type
payrollSchema.index({ employeeId: 1, monthYear: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);

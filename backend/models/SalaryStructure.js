const mongoose = require('mongoose');

const salaryStructureSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    basicSalary: {
      type: Number,
      required: [true, 'Basic Salary is required'],
      min: 0,
    },
    pfAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    mediclaimAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Unique compound index on role + designation
salaryStructureSchema.index({ role: 1, designation: 1 }, { unique: true });

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);

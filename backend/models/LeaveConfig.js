const mongoose = require('mongoose');

const leaveConfigSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    casualLeaves: {
      type: Number,
      default: 0,
      min: 0,
    },
    emergencyLeaves: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Ensure only one config per company + designation + department + year
leaveConfigSchema.index({ companyId: 1, designation: 1, department: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveConfig', leaveConfigSchema);

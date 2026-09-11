const mongoose = require('mongoose');

const leaveConfigSchema = new mongoose.Schema(
  {
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

// Ensure only one config per designation per department per year
leaveConfigSchema.index({ designation: 1, department: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveConfig', leaveConfigSchema);

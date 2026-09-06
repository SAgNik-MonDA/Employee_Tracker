const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['Casual', 'Emergency'],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    // Number of calendar days (auto-calculated on apply)
    days: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

// Helper: calculate days from startDate/endDate (for backward compat)
leaveSchema.virtual('calculatedDays').get(function () {
  if (this.days) return this.days;
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1;
});

module.exports = mongoose.model('Leave', leaveSchema);

const mongoose = require('mongoose');

const shiftScheduleSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shiftType: {
      type: String,
      enum: ['Morning', 'General', 'Evening', 'Night'],
      required: true,
      default: 'General'
    },
    date: {
      type: Date,
      required: true,
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    teamId: {
      type: String,
      default: ''
    },
  },
  { timestamps: true }
);

// Prevent duplicate shift entries for same employee on same date
shiftScheduleSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ShiftSchedule', shiftScheduleSchema);

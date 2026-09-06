const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late'],
      default: 'Present',
    },
    shiftAssigned: {
      type: String,
      enum: ['Morning', 'General', 'Evening', 'Night', 'None'],
      default: 'None'
    },
    lateDuration: {
      type: Number, // in minutes
      default: 0
    },
    earlyCheckoutDuration: {
      type: Number, // in minutes
      default: 0
    },
    earlyCheckoutStatus: {
      type: String,
      enum: ['None', 'Pending_TL', 'Pending_PM', 'Approved', 'Rejected'],
      default: 'None'
    },
    earlyCheckoutReason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// One attendance record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

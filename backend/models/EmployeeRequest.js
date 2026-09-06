const mongoose = require('mongoose');

const employeeRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: ['Hardware', 'Software', 'Network/IT', 'HR/Admin', 'Shift Change', 'Other']
    },
    reason: {
      type: String,
      required: true,
    },
    dateRequestedFor: {
      type: Date,
      required: true,
    },
    shiftDate: {
      type: Date,
      default: null
    },
    currentShift: {
      type: String,
      enum: ['Morning', 'General', 'Evening', 'Night', ''],
      default: ''
    },
    desiredShift: {
      type: String,
      enum: ['Morning', 'General', 'Evening', 'Night', ''],
      default: ''
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewNotes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeRequest', employeeRequestSchema);

const mongoose = require('mongoose');

const FaceResetLogSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeCode: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Approved', 'Rejected'],
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerName: {
      type: String,
      default: '',
    },
    reviewerRole: {
      type: String,
      default: '',
    },
    reviewerEmployeeCode: {
      type: String,
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FaceResetLog', FaceResetLogSchema);

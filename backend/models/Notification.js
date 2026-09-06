const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'leave_applied',
        'leave_approved',
        'leave_rejected',
        'payroll_generated',
        'performance_reviewed',
        'meeting_invited',
        'meeting_mom',
        'meeting_rejoin_request',
        'meeting_rejoin_approved',
        'shift_assigned',
        'team_expiry_warning',
        'team_auto_archived'
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

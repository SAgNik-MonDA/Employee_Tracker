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
        'team_auto_archived',
        'early_checkout_requested',
        'early_checkout_approved',
        'early_checkout_rejected',
        'face_reset_requested',
        'face_reset_approved',
        'face_reset_rejected',
        'general_request_submitted',
        'general_request_reviewed',
        'leave_quota_assigned'
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

// Emit real-time notification using global Socket.io instance
notificationSchema.post('save', function (doc) {
  if (global.io) {
    global.io.to(`user-${doc.userId.toString()}`).emit('new-notification', doc);
  }
});

notificationSchema.post('insertMany', function (docs) {
  if (global.io && Array.isArray(docs)) {
    docs.forEach(doc => {
      global.io.to(`user-${doc.userId.toString()}`).emit('new-notification', doc);
    });
  }
});

module.exports = mongoose.model('Notification', notificationSchema);

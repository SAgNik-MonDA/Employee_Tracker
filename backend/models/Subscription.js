const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      default: '',
      trim: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    adminEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    adminPhone: {
      type: String,
      default: '',
      trim: true,
    },
    planId: {
      type: String,
      enum: ['monthly', 'yearly', 'three_year'],
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['active', 'expiring_soon', 'grace_period', 'expired'],
      default: 'active',
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    history: [
      {
        planId: { type: String, required: true },
        planName: { type: String, required: true },
        amount: { type: Number, required: true },
        paymentDate: { type: Date, default: Date.now },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        razorpayPaymentId: { type: String, default: '' },
      },
    ],
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
    isPurged: {
      type: Boolean,
      default: false,
    },
    purgedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Virtual for calculating remaining days dynamically
subscriptionSchema.virtual('daysRemaining').get(function () {
  const diffTime = new Date(this.endDate).getTime() - Date.now();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

subscriptionSchema.set('toJSON', { virtuals: true });
subscriptionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);

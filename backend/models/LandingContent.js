const mongoose = require('mongoose');

const landingContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'main_landing_cms',
      unique: true,
    },
    pricingPlans: {
      monthly: {
        price: { type: Number, default: 999 },
        originalPrice: { type: Number, default: 1499 },
        title: { type: String, default: 'Monthly Flex' },
        description: { type: String, default: 'Flexible month-to-month dynamic workforce management' },
        billingCycle: { type: String, default: 'per month' },
        features: {
          type: [String],
          default: [
            'All Enterprise HRMS Features',
            'AI Biometric Face & QR Attendance',
            'Automated Statutory PF & Mediclaim Deductions',
            'Up to 50 Active Employees',
            'Standard Email Support',
            'Full Data Encryption',
          ],
        },
      },
      yearly: {
        price: { type: Number, default: 9999 },
        originalPrice: { type: Number, default: 15999 },
        title: { type: String, default: 'Annual Growth' },
        description: { type: String, default: 'Best value for growing enterprise teams & organizations' },
        billingCycle: { type: String, default: 'per year' },
        isPopular: { type: Boolean, default: true },
        features: {
          type: [String],
          default: [
            'Everything in Monthly Flex Plan',
            'Up to 250 Active Employees',
            'Finance Bank Transfer Advice (PDF/Excel)',
            'Multi-Shift Rostering & Geo-Fencing Tracking',
            'Priority 24/7 Enterprise Support',
            '2 Months Absolutely Free (Save 38%)',
          ],
        },
      },
      three_year: {
        price: { type: Number, default: 24999 },
        originalPrice: { type: Number, default: 44999 },
        title: { type: String, default: '3-Year Enterprise' },
        description: { type: String, default: 'Maximum long-term corporate savings with zero rate hikes' },
        billingCycle: { type: String, default: 'for 3 years' },
        badge: { type: String, default: 'Best Value' },
        features: {
          type: [String],
          default: [
            'Everything in Annual Growth Plan',
            'Unlimited Active Employees & Shifts',
            'Dedicated Enterprise Account Manager',
            'Custom Cloud Backups & Enterprise SLA',
            'Zero Price Increase Guarantee for 3 Years',
            'Over 45% Massive Direct Savings!',
          ],
        },
      },
    },
    clients: [
      {
        name: { type: String, required: true },
        logoUrl: { type: String, required: true },
        website: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    faqs: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true },
        order: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('LandingContent', landingContentSchema);

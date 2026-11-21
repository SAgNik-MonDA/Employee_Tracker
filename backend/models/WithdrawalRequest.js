const mongoose = require('mongoose');
const crypto = require('crypto');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    claimId: {
      type: String,
      unique: true,
      sparse: true,
    },
    mediclaimId: {
      type: String,
      default: '',
    },
    pfId: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['PF', 'Mediclaim'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    approvedAmount: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String, // Reason for Mediclaim or PF
    },
    diseaseName: {
      type: String, // For Mediclaim
    },
    purpose: {
      type: String, // For Mediclaim category / dropdown
      enum: [
        'Medical Emergencies',
        'Hospitalization & Surgery',
        'Cashless Treatment',
        'Prescription Medicines & Diagnostic Tests',
        'Tax Saving / Tax Benefits',
        'Preventive Health Check-up',
        'Maternity and Newborn Care',
        'Critical Illness Cover',
        'Family Protection',
        'Financial Security / Wealth Protection',
        'Other Illness / Treatment',
        ''
      ],
    },
    attachment: {
      type: String, // Base64 string or URL for prescription/bill
    },
    prescription: {
      type: String, // Alias/URL for prescription document
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
      default: 'Pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewNotes: {
      type: String,
      default: '',
    },
    settlementSlipGenerated: {
      type: Boolean,
      default: false,
    },
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
    }
  },
  { timestamps: true }
);

// Auto-generate claim ID before save if not present
withdrawalRequestSchema.pre('save', function (next) {
  if (!this.claimId) {
    const prefix = this.type === 'Mediclaim' ? 'CLM-MED' : 'CLM-PF';
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const year = new Date().getFullYear();
    this.claimId = `${prefix}-${year}-${randomHex}`;
  }
  next();
});

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

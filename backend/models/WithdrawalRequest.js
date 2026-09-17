const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    reason: {
      type: String, // Mostly for PF
    },
    diseaseName: {
      type: String, // For Mediclaim
    },
    purpose: {
      type: String, // For Mediclaim dropdown
      enum: [
        'Medical Emergencies',
        'Cashless Treatment',
        'Tax Saving / Tax Benefits',
        'Preventive Health Check-up',
        'Maternity and Newborn Care',
        'Critical Illness Cover',
        'Family Protection',
        'Financial Security / Wealth Protection',
        ''
      ],
    },
    attachment: {
      type: String, // Base64 string for prescription/bill
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
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

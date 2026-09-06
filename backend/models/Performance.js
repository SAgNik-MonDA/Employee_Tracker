const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    monthYear: {
      type: String, // MM-YYYY
      required: true,
    },
    kpiRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// One review per employee per month
performanceSchema.index({ employeeId: 1, monthYear: 1 }, { unique: true });

module.exports = mongoose.model('Performance', performanceSchema);

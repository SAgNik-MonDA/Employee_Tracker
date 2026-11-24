const mongoose = require('mongoose');

const visitorMetricSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'global_visitors',
      unique: true,
    },
    count: {
      type: Number,
      default: 1240, // Base organic count for immediate display
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VisitorMetric', visitorMetricSchema);

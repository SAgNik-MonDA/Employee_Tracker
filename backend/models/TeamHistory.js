const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamHistorySchema = new Schema(
  {
    teamId: {
      type: String,
      default: function() { return 'TM-' + Math.floor(1000 + Math.random() * 9000); },
      trim: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    members: [{
      _id: Schema.Types.ObjectId,
      name: String,
      employeeCode: String,
      designation: String,
      role: String,
      profilePicture: String,
    }],
    teamLead: {
      _id: Schema.Types.ObjectId,
      name: String,
      employeeCode: String,
      designation: String,
      role: String,
      profilePicture: String,
    },
    createdBy: {
      _id: Schema.Types.ObjectId,
      name: String,
      employeeCode: String,
      designation: String,
      role: String,
      profilePicture: String,
    },
    startDate: { type: Date, default: null },
    endDate:   { type: Date, default: null },
    completedAt: { type: Date, default: Date.now },
    techStack: [{ type: String }],
    status: {
      type: String,
      default: 'Completed',
    },
    documents: [Schema.Types.Mixed],
    progressUpdates: [Schema.Types.Mixed],
    shifts: [Schema.Types.Mixed],
    reasonArchived: {
      type: String,
      default: 'Auto-completed after project end date expired',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeamHistory', teamHistorySchema);

const mongoose = require('mongoose');
const { Schema } = mongoose;

const documentSchema = new Schema({
  type:        { type: String, enum: ['file', 'text'], required: true },
  filename:    { type: String, default: '' },
  fileUrl:     { type: String, default: '' },
  content:     { type: String, default: '' },
  uploadedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  uploadedAt:  { type: Date, default: Date.now },
});

const progressUpdateSchema = new Schema({
  message:       { type: String, required: true },
  submittedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt:   { type: Date, default: Date.now },
  pmApprovedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  pmApprovedAt:  { type: Date, default: null },
  dmApprovedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  dmApprovedAt:  { type: Date, default: null },
  status: {
    type: String,
    enum: ['Pending', 'PM Approved', 'DM Approved', 'Rejected'],
    default: 'Pending',
  },
  rejectedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rejectReason: { type: String, default: '' },
});

const shiftSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shiftType: {
    type: String,
    enum: ['Morning', 'General', 'Evening', 'Night'],
    required: true,
  },
  date:        { type: Date, required: true },
  scheduledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  isLocked:    { type: Boolean, default: false },
});

const teamSchema = new Schema(
  {
    teamId: {
      type: String,
      unique: true,
      trim: true,
    },
    projectName: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    teamLead: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, default: null },
    endDate:   { type: Date, default: null },
    techStack: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ['Active', 'Completed', 'On Hold'],
      default: 'Active',
    },
    documents:       [documentSchema],
    progressUpdates: [progressUpdateSchema],
    shifts:          [shiftSchema],
    expiryWarningSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

teamSchema.pre('save', async function (next) {
  if (!this.teamId) {
    try {
      const activeTeams = await mongoose.model('Team').find({}, 'teamId');
      const historyTeams = await mongoose.model('TeamHistory').find({}, 'teamId');

      let maxNum = 0;
      const checkTeam = (t) => {
        if (t.teamId && typeof t.teamId === 'string') {
          const match = t.teamId.match(/^TM-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      };

      activeTeams.forEach(checkTeam);
      historyTeams.forEach(checkTeam);

      this.teamId = 'TM-' + String(maxNum + 1).padStart(4, '0');
    } catch (e) {
      const count = await mongoose.model('Team').countDocuments();
      this.teamId = 'TM-' + String(count + 1).padStart(4, '0');
    }
  }
  next();
});

module.exports = mongoose.model('Team', teamSchema);

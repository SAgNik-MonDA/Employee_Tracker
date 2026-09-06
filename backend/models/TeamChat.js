const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamChatSchema = new Schema(
  {
    teamId:   { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message:  { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeamChat', teamChatSchema);

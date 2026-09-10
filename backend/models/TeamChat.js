const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamChatSchema = new Schema(
  {
    teamId:   { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message:  { type: String, required: true, trim: true },
    isEdited:  { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    editedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeamChat', teamChatSchema);

const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, trim: true },
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'video', 'audio', 'file', 'system'], 
    default: 'text' 
  },
  media: {
    url: String,
    type: String,
    filename: String,
    size: Number
  },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupMessage' },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for better performance
groupMessageSchema.index({ group: 1, createdAt: -1 });
groupMessageSchema.index({ sender: 1 });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);

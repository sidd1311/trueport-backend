const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  verificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Verification',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: ['CREATED', 'APPROVED', 'REJECTED', 'VIEWED'],
    index: true
  },
  actorEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We're using our own timestamp field
});

// Indexes for better query performance
verificationLogSchema.index({ verificationId: 1, timestamp: -1 });
verificationLogSchema.index({ actorEmail: 1 });
verificationLogSchema.index({ action: 1 });

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
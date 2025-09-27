const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  itemType: {
    type: String,
    required: true,
    enum: ['EXPERIENCE', 'EDUCATION', 'GITHUB_PROJECT'],
    index: true
  },
  // Legacy field for backward compatibility
  experienceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experience'
  },
  verifierEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    index: true
  },
  comment: {
    type: String,
    maxLength: 1000
  },
  actedBy: {
    type: String, // Email of person who acted
    trim: true
  },
  actedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
    },
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
verificationSchema.index({ token: 1 });
verificationSchema.index({ itemId: 1, itemType: 1 });
verificationSchema.index({ experienceId: 1 }); // Keep for backward compatibility
verificationSchema.index({ verifierEmail: 1 });
verificationSchema.index({ status: 1 });

// Pre-save middleware to handle backward compatibility
verificationSchema.pre('save', function(next) {
  // For backward compatibility, set experienceId if itemType is EXPERIENCE
  if (this.itemType === 'EXPERIENCE' && this.itemId) {
    this.experienceId = this.itemId;
  }
  next();
});

// Update actedAt when status changes
verificationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'PENDING') {
    this.actedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Verification', verificationSchema);
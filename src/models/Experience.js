const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: true,
    maxLength: 2000
  },
  role: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxLength: 50
  }],
  attachments: [{
    type: String, // Cloudinary URLs
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Attachment must be a valid URL'
    }
  }],
  verified: {
    type: Boolean,
    default: false,
    index: true
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: String,
    trim: true,
    maxLength: 200
  },
  verifierComment: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  isPublic: {
    type: Boolean,
    default: true // By default, experiences are public
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
experienceSchema.index({ userId: 1, createdAt: -1 });
experienceSchema.index({ verified: 1 });
experienceSchema.index({ tags: 1 });

// Update verifiedAt when verified status changes
experienceSchema.pre('save', function(next) {
  if (this.isModified('verified') && this.verified) {
    this.verifiedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Experience', experienceSchema);
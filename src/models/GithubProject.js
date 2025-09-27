const mongoose = require('mongoose');

const githubProjectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  repositoryUrl: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/.test(v);
      },
      message: 'Repository URL must be a valid GitHub repository URL'
    }
  },
  projectName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: true,
    maxLength: 1000,
    trim: true
  },
  learnings: {
    type: String,
    required: true,
    maxLength: 2000,
    trim: true
  },
  technologies: [{
    type: String,
    trim: true,
    maxLength: 50
  }],
  liveUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Live URL must be a valid URL'
    }
  },
  isLive: {
    type: Boolean,
    default: false
  },
  projectType: {
    type: String,
    enum: ['PERSONAL', 'ACADEMIC', 'PROFESSIONAL', 'OPEN_SOURCE', 'HACKATHON', 'OTHER'],
    default: 'PERSONAL'
  },
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
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
githubProjectSchema.index({ userId: 1, createdAt: -1 });
githubProjectSchema.index({ verified: 1 });
githubProjectSchema.index({ projectType: 1 });
githubProjectSchema.index({ technologies: 1 });

// Update verifiedAt when verified status changes
githubProjectSchema.pre('save', function(next) {
  if (this.isModified('verified') && this.verified) {
    this.verifiedAt = new Date();
  }
  
  // Set isLive based on liveUrl
  if (this.isModified('liveUrl')) {
    this.isLive = !!this.liveUrl;
  }
  
  next();
});

module.exports = mongoose.model('GithubProject', githubProjectSchema);
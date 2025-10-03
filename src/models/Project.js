const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Basic Project Info
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: true,
    maxLength: 2000,
    trim: true
  },
  
  // Project Category
  category: {
    type: String,
    required: true,
    enum: [
      // Tech Projects
      'SOFTWARE_DEVELOPMENT',
      'WEB_APPLICATION', 
      'MOBILE_APP',
      'DATA_SCIENCE',
      'AI_ML_PROJECT',
      
      // Design Projects
      'UI_UX_DESIGN',
      'GRAPHIC_DESIGN',
      'PRODUCT_DESIGN',
      'BRAND_IDENTITY',
      'DIGITAL_ART',
      
      // Business Projects
      'BUSINESS_PLAN',
      'MARKET_RESEARCH',
      'STARTUP_PITCH',
      'MARKETING_CAMPAIGN',
      'FINANCIAL_ANALYSIS',
      
      // Academic Projects
      'RESEARCH_PAPER',
      'THESIS_PROJECT',
      'CASE_STUDY',
      'LAB_EXPERIMENT',
      'SURVEY_STUDY',
      
      // Creative Projects
      'CREATIVE_WRITING',
      'PHOTOGRAPHY',
      'VIDEO_PRODUCTION',
      'MUSIC_COMPOSITION',
      'ART_PROJECT',
      
      // Other
      'COMMUNITY_SERVICE',
      'INTERNSHIP_PROJECT',
      'FREELANCE_WORK',
      'COMPETITION_ENTRY',
      'OTHER'
    ],
    default: 'OTHER'
  },
  
  // Project Type
  projectType: {
    type: String,
    enum: ['PERSONAL', 'ACADEMIC', 'PROFESSIONAL', 'OPEN_SOURCE', 'HACKATHON', 'COMPETITION', 'INTERNSHIP', 'FREELANCE', 'OTHER'],
    default: 'PERSONAL'
  },
  
  // URLs and Links
  links: {
    githubUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/.test(v);
        },
        message: 'GitHub URL must be a valid GitHub repository URL'
      }
    },
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
    portfolioUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Portfolio URL must be a valid URL'
      }
    },
    documentUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Document URL must be a valid URL'
      }
    },
    videoUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Video URL must be a valid URL'
      }
    }
  },
  
  // Skills and Technologies
  skillsUsed: [{
    type: String,
    trim: true,
    maxLength: 50
  }],
  
  // Key Features/Highlights
  keyFeatures: [{
    type: String,
    trim: true,
    maxLength: 200
  }],
  
  // What was learned
  learnings: {
    type: String,
    maxLength: 2000,
    trim: true
  },
  
  // Challenges faced
  challenges: {
    type: String,
    maxLength: 1500,
    trim: true
  },
  
  // Project outcome/results
  outcome: {
    type: String,
    maxLength: 1000,
    trim: true
  },
  
  // Duration
  duration: {
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    isOngoing: {
      type: Boolean,
      default: false
    }
  },
  
  // Team Information
  teamSize: {
    type: Number,
    min: 1,
    max: 50,
    default: 1
  },
  
  collaborators: [{
    name: {
      type: String,
      trim: true,
      maxLength: 100
    },
    role: {
      type: String,
      trim: true,
      maxLength: 100
    },
    email: {
      type: String,
      trim: true
    }
  }],
  
  // Academic Context
  course: {
    type: String,
    trim: true,
    maxLength: 200
  },
  
  supervisor: {
    type: String,
    trim: true,
    maxLength: 100
  },
  
  grade: {
    type: String,
    trim: true,
    maxLength: 10
  },
  
  // Media attachments (URLs to cloud storage)
  attachments: {
    images: [{
      type: String,
      trim: true
    }],
    videos: [{
      type: String,
      trim: true
    }],
    documents: [{
      type: String,
      trim: true
    }]
  },
  // Note: Projects don't require verification as they can be individual work
  
  // Visibility
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Metrics
  views: {
    type: Number,
    default: 0
  },
  
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ projectType: 1 });
projectSchema.index({ category: 1 });
projectSchema.index({ skillsUsed: 1 });
projectSchema.index({ 'duration.startDate': 1 });

// Text search index for better search functionality
projectSchema.index({
  title: 'text',
  description: 'text',
  skillsUsed: 'text',
  keyFeatures: 'text'
});

// Projects don't need verification pre-save hooks

// Virtual for like count
projectSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for project age in days
projectSchema.virtual('projectAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON
projectSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Project', projectSchema);
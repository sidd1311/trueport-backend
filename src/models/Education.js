const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  courseType: {
    type: String,
    required: true,
    enum: ['10TH', '12TH', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'PHD', 'CERTIFICATE', 'OTHER'],
    trim: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  boardOrUniversity: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  schoolOrCollege: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  passingYear: {
    type: Number,
    required: true,
    min: 1990,
    max: new Date().getFullYear() + 10 // Allow expected graduation up to 10 years in future
  },
  isExpected: {
    type: Boolean,
    default: false
  },
  grade: {
    type: String,
    trim: true,
    maxLength: 50
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  cgpa: {
    type: Number,
    min: 0,
    max: 10
  },
  description: {
    type: String,
    maxLength: 500,
    trim: true
  },
  attachments: [{
    type: String, // Cloudinary URLs for certificates/transcripts
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
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
educationSchema.index({ userId: 1, passingYear: -1 });
educationSchema.index({ verified: 1 });
educationSchema.index({ courseType: 1 });

// Update verifiedAt when verified status changes
educationSchema.pre('save', function(next) {
  if (this.isModified('verified') && this.verified) {
    this.verifiedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Education', educationSchema);
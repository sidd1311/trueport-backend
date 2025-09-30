const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxLength: 200
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  logo: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  contactInfo: {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: String
  },
  settings: {
    allowSelfRegistration: {
      type: Boolean,
      default: true
    },
    requireVerifierApproval: {
      type: Boolean,
      default: true
    },
    maxUsersLimit: {
      type: Number,
      default: 1000
    }
  },
  stats: {
    totalUsers: {
      type: Number,
      default: 0
    },
    totalStudents: {
      type: Number,
      default: 0
    },
    totalVerifiers: {
      type: Number,
      default: 0
    },
    totalVerifications: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    default: 'ACTIVE'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
institutionSchema.index({ name: 1 });
institutionSchema.index({ status: 1 });
institutionSchema.index({ createdAt: -1 });

// Update stats whenever users are added/removed
institutionSchema.statics.updateStats = async function(institutionName) {
  try {
    const User = require('./User');
    
    const stats = await User.aggregate([
      { $match: { institute: institutionName } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsObj = {
      totalUsers: 0,
      totalStudents: 0,
      totalVerifiers: 0
    };

    stats.forEach(stat => {
      if (stat._id === 'STUDENT') statsObj.totalStudents = stat.count;
      if (stat._id === 'VERIFIER') statsObj.totalVerifiers = stat.count;
    });

    statsObj.totalUsers = statsObj.totalStudents + statsObj.totalVerifiers;

    await this.findOneAndUpdate(
      { name: institutionName },
      { 
        'stats.totalUsers': statsObj.totalUsers,
        'stats.totalStudents': statsObj.totalStudents,
        'stats.totalVerifiers': statsObj.totalVerifiers,
        updatedAt: new Date() 
      }
    );
    
    console.log(`Updated stats for institution: ${institutionName}`);
  } catch (error) {
    console.error('Update institution stats error:', error);
  }
};

module.exports = mongoose.model('Institution', institutionSchema);
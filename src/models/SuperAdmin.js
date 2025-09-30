const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const superAdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN'],
    default: 'SUPER_ADMIN'
  },
  permissions: {
    manageInstitutions: {
      type: Boolean,
      default: true
    },
    manageInstituteAdmins: {
      type: Boolean,
      default: true
    },
    viewSystemAnalytics: {
      type: Boolean,
      default: true
    },
    manageSystemSettings: {
      type: Boolean,
      default: true
    },
    accessAllData: {
      type: Boolean,
      default: true
    }
  },
  profilePicture: {
    type: String,
    trim: true
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
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
superAdminSchema.index({ email: 1 });
superAdminSchema.index({ isActive: 1 });

// Virtual for checking if account is locked
superAdminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Password hashing middleware
superAdminSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
superAdminSchema.methods.comparePassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

// Method to handle login attempts
superAdminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 4 hours (higher security)
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 4 * 60 * 60 * 1000 }; // 4 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
superAdminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update last login
superAdminSchema.methods.updateLastLogin = function() {
  return this.updateOne({ lastLogin: new Date() });
};

// Transform output
superAdminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.passwordHash;
  delete admin.loginAttempts;
  delete admin.lockUntil;
  delete admin.twoFactorSecret;
  return admin;
};

module.exports = mongoose.model('SuperAdmin', superAdminSchema);
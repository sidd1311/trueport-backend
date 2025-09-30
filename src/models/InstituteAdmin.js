const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const instituteAdminSchema = new mongoose.Schema({
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
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[+]?[\d\s\-()]+$/, 'Please enter a valid phone number']
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['INSTITUTE_ADMIN'],
    default: 'INSTITUTE_ADMIN'
  },
  institution: {
    type: String,
    required: true,
    // ref: 'Institution'
  },
  permissions: {
    manageUsers: {
      type: Boolean,
      default: true
    },
    manageVerifiers: {
      type: Boolean,
      default: true
    },
    viewAnalytics: {
      type: Boolean,
      default: true
    },
    manageSettings: {
      type: Boolean,
      default: false
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
instituteAdminSchema.index({ email: 1 });
instituteAdminSchema.index({ institution: 1 });
instituteAdminSchema.index({ isActive: 1 });

// Virtual for checking if account is locked
instituteAdminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Password hashing middleware
instituteAdminSchema.pre('save', async function(next) {
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
instituteAdminSchema.methods.comparePassword = async function(password) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

// Method to handle login attempts
instituteAdminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
instituteAdminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update last login
instituteAdminSchema.methods.updateLastLogin = function() {
  return this.updateOne({ lastLogin: new Date() });
};

// Transform output
instituteAdminSchema.methods.toJSON = function() {
  const admin = this.toObject();
  delete admin.passwordHash;
  delete admin.loginAttempts;
  delete admin.lockUntil;
  return admin;
};

module.exports = mongoose.model('InstituteAdmin', instituteAdminSchema);
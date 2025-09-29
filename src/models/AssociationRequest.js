const mongoose = require('mongoose');

const associationRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  studentName: {
    type: String,
    required: true
  },
  verifierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for institute-based requests
  },
  verifierEmail: {
    type: String,
    required: false,
    lowercase: true
  },
  verifierName: {
    type: String,
    required: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Track which verifier approved the request
  },
  institute: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  requestedRole: {
    type: String,
    enum: ['STUDENT', 'VERIFIER'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  requestMessage: {
    type: String,
    trim: true,
    maxLength: 500
  },
  verifierResponse: {
    type: String,
    trim: true,
    maxLength: 500
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
associationRequestSchema.index({ studentId: 1, verifierId: 1 });
associationRequestSchema.index({ verifierId: 1, status: 1 });
associationRequestSchema.index({ studentId: 1, status: 1 });
associationRequestSchema.index({ institute: 1, status: 1 });
associationRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent duplicate pending requests for the same student and institute
associationRequestSchema.index(
  { studentId: 1, institute: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'PENDING' }
  }
);

// Virtual for request age
associationRequestSchema.virtual('requestAge').get(function() {
  return Math.floor((Date.now() - this.requestedAt) / (1000 * 60 * 60 * 24)); // Days
});

// Method to check if request is expired
associationRequestSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Static method to find pending requests for a verifier's institute
associationRequestSchema.statics.findPendingForInstitute = function(institute) {
  return this.find({
    institute,
    status: 'PENDING',
    expiresAt: { $gt: new Date() }
  }).populate('studentId', 'name email profilePicture');
};

// Static method to find user's pending requests
associationRequestSchema.statics.findUserPendingRequests = function(studentId) {
  return this.find({
    studentId,
    status: 'PENDING',
    expiresAt: { $gt: new Date() }
  }).populate('verifierId', 'name email institute');
};

module.exports = mongoose.model('AssociationRequest', associationRequestSchema);
const express = require('express');
const Experience = require('../models/Experience');
const Verification = require('../models/Verification');
const VerificationLog = require('../models/VerificationLog');
const { requireAuth } = require('../middlewares/auth');
const { generateVerificationToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

// Request verification for an experience
router.post('/request/:experienceId', requireAuth, async (req, res) => {
  try {
    const { verifierEmail } = req.body;

    if (!verifierEmail) {
      return res.status(400).json({ 
        message: 'Verifier email is required' 
      });
    }

    // Check if experience exists and belongs to user
    const experience = await Experience.findOne({
      _id: req.params.experienceId,
      userId: req.user._id
    }).populate('userId', 'name email');

    if (!experience) {
      return res.status(404).json({ 
        message: 'Experience not found' 
      });
    }

    if (experience.verified) {
      return res.status(400).json({ 
        message: 'Experience is already verified' 
      });
    }

    // Check for existing pending verification
    const existingVerification = await Verification.findOne({
      experienceId: req.params.experienceId,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (existingVerification) {
      return res.status(400).json({ 
        message: 'Verification request already pending for this experience' 
      });
    }

    // Generate verification token
    const token = generateVerificationToken();

    // Create verification record
    const verification = new Verification({
      experienceId: req.params.experienceId,
      verifierEmail: verifierEmail.toLowerCase(),
      token
    });

    await verification.save();

    // Log the verification request
    await new VerificationLog({
      verificationId: verification._id,
      action: 'CREATED',
      actorEmail: req.user.email,
      metadata: { verifierEmail }
    }).save();

    // Send verification email
    const emailSent = await sendVerificationEmail(
      verifierEmail,
      token,
      experience.title,
      experience.userId.name
    );

    if (!emailSent) {
      console.warn('Failed to send verification email, but request was created');
    }

    res.status(201).json({
      message: 'Verification request sent successfully',
      verification: {
        id: verification._id,
        verifierEmail: verification.verifierEmail,
        status: verification.status,
        expiresAt: verification.expiresAt
      }
    });

  } catch (error) {
    console.error('Verification request error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid experience ID' });
    }

    res.status(500).json({ 
      message: 'Failed to create verification request', 
      error: error.message 
    });
  }
});

// Get verification details by token (public)
router.get('/:token', async (req, res) => {
  try {
    const verification = await Verification.findOne({ 
      token: req.params.token,
      expiresAt: { $gt: new Date() }
    }).populate({
      path: 'experienceId',
      populate: {
        path: 'userId',
        select: 'name email githubUsername'
      }
    });

    if (!verification) {
      return res.status(404).json({ 
        message: 'Verification not found or expired' 
      });
    }

    // Log the view
    await new VerificationLog({
      verificationId: verification._id,
      action: 'VIEWED',
      actorEmail: verification.verifierEmail,
      metadata: { userAgent: req.get('User-Agent') }
    }).save();

    res.json({
      verification: {
        id: verification._id,
        status: verification.status,
        verifierEmail: verification.verifierEmail,
        comment: verification.comment,
        actedBy: verification.actedBy,
        actedAt: verification.actedAt,
        expiresAt: verification.expiresAt,
        experience: verification.experienceId
      }
    });

  } catch (error) {
    console.error('Get verification error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch verification', 
      error: error.message 
    });
  }
});

// Approve verification
router.post('/:token/approve', async (req, res) => {
  try {
    const { comment, actorEmail } = req.body;

    if (!actorEmail) {
      return res.status(400).json({ 
        message: 'Actor email is required' 
      });
    }

    const verification = await Verification.findOne({ 
      token: req.params.token,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(404).json({ 
        message: 'Verification not found, already processed, or expired' 
      });
    }

    // Update verification
    verification.status = 'APPROVED';
    verification.comment = comment || '';
    verification.actedBy = actorEmail.toLowerCase();
    await verification.save();

    // Update experience as verified
    await Experience.findByIdAndUpdate(verification.experienceId, {
      verified: true,
      verifiedAt: new Date()
    });

    // Log the approval
    await new VerificationLog({
      verificationId: verification._id,
      action: 'APPROVED',
      actorEmail: actorEmail.toLowerCase(),
      metadata: { comment: comment || '' }
    }).save();

    res.json({
      message: 'Experience verified successfully',
      verification: {
        id: verification._id,
        status: verification.status,
        comment: verification.comment,
        actedBy: verification.actedBy,
        actedAt: verification.actedAt
      }
    });

  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({ 
      message: 'Failed to approve verification', 
      error: error.message 
    });
  }
});

// Reject verification
router.post('/:token/reject', async (req, res) => {
  try {
    const { comment, actorEmail } = req.body;

    if (!actorEmail) {
      return res.status(400).json({ 
        message: 'Actor email is required' 
      });
    }

    const verification = await Verification.findOne({ 
      token: req.params.token,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(404).json({ 
        message: 'Verification not found, already processed, or expired' 
      });
    }

    // Update verification
    verification.status = 'REJECTED';
    verification.comment = comment || '';
    verification.actedBy = actorEmail.toLowerCase();
    await verification.save();

    // Log the rejection
    await new VerificationLog({
      verificationId: verification._id,
      action: 'REJECTED',
      actorEmail: actorEmail.toLowerCase(),
      metadata: { comment: comment || '' }
    }).save();

    res.json({
      message: 'Verification rejected',
      verification: {
        id: verification._id,
        status: verification.status,
        comment: verification.comment,
        actedBy: verification.actedBy,
        actedAt: verification.actedAt
      }
    });

  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({ 
      message: 'Failed to reject verification', 
      error: error.message 
    });
  }
});

// Get verification history for an experience (owner only)
router.get('/history/:experienceId', requireAuth, async (req, res) => {
  try {
    // Check if experience belongs to user
    const experience = await Experience.findOne({
      _id: req.params.experienceId,
      userId: req.user._id
    });

    if (!experience) {
      return res.status(404).json({ 
        message: 'Experience not found' 
      });
    }

    const verifications = await Verification.find({
      experienceId: req.params.experienceId
    }).sort({ createdAt: -1 });

    res.json({ verifications });

  } catch (error) {
    console.error('Get verification history error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid experience ID' });
    }

    res.status(500).json({ 
      message: 'Failed to fetch verification history', 
      error: error.message 
    });
  }
});

module.exports = router;
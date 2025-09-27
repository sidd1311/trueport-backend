const express = require('express');
const User = require('../models/User');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const GithubProject = require('../models/GithubProject');
const Verification = require('../models/Verification');
const VerificationLog = require('../models/VerificationLog');
const { requireAuth } = require('../middlewares/auth');
const { generateVerificationToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

// Helper function to get model and item based on type
const getModelAndItem = async (itemType, itemId, userId = null) => {
  let Model, item;
  
  switch (itemType.toUpperCase()) {
    case 'EXPERIENCE':
      Model = Experience;
      break;
    case 'EDUCATION':
      Model = Education;
      break;
    case 'GITHUB_PROJECT':
      Model = GithubProject;
      break;
    default:
      throw new Error('Invalid item type');
  }

  const query = { _id: itemId };
  if (userId) {
    query.userId = userId;
  }

  item = await Model.findOne(query).populate('userId', 'name email');
  return { Model, item };
};

// Request verification for any item type
router.post('/request/:itemType/:itemId', requireAuth, async (req, res) => {
  try {
    const { verifierEmail } = req.body;
    const { itemType, itemId } = req.params;

    if (!verifierEmail) {
      return res.status(400).json({ 
        message: 'Verifier email is required' 
      });
    }

    // Validate item type
    const validTypes = ['EXPERIENCE', 'EDUCATION', 'GITHUB_PROJECT'];
    if (!validTypes.includes(itemType.toUpperCase())) {
      return res.status(400).json({
        message: 'Invalid item type. Must be one of: ' + validTypes.join(', ')
      });
    }

    // Check if item exists and belongs to user
    const { Model, item } = await getModelAndItem(itemType, itemId, req.user._id);

    if (!item) {
      return res.status(404).json({ 
        message: `${itemType.toLowerCase()} not found` 
      });
    }

    if (item.verified) {
      return res.status(400).json({ 
        message: `${itemType.toLowerCase()} is already verified` 
      });
    }

    // Verify that verifier exists and belongs to same institute
    const verifier = await User.findOne({ 
      email: verifierEmail.toLowerCase(),
      role: 'VERIFIER' 
    });

    if (!verifier) {
      return res.status(400).json({ 
        message: 'Verifier not found or not registered as verifier' 
      });
    }

    const student = await User.findById(req.user._id);
    
    if (!student.institute || !verifier.institute) {
      return res.status(400).json({ 
        message: 'Both student and verifier must have institutes associated' 
      });
    }

    if (student.institute !== verifier.institute) {
      return res.status(403).json({ 
        message: 'Verification can only be requested from verifiers in your institution' 
      });
    }

    // Check for existing pending verification
    const existingVerification = await Verification.findOne({
      itemId: itemId,
      itemType: itemType.toUpperCase(),
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (existingVerification) {
      return res.status(400).json({ 
        message: `Verification request already pending for this ${itemType.toLowerCase()}` 
      });
    }

    // Generate verification token
    const token = generateVerificationToken();

    // Create verification record
    const verification = new Verification({
      itemId: itemId,
      itemType: itemType.toUpperCase(),
      verifierEmail: verifierEmail.toLowerCase(),
      token
    });

    await verification.save();

    // Log the verification request
    await new VerificationLog({
      verificationId: verification._id,
      action: 'CREATED',
      actorEmail: req.user.email,
      metadata: { verifierEmail, itemType }
    }).save();

    // Send verification email
    const itemTitle = item.title || item.courseName || item.projectName || 'Item';
    const emailSent = await sendVerificationEmail(
      verifierEmail,
      token,
      itemTitle,
      item.userId.name,
      itemType.toUpperCase()
    );

    if (!emailSent) {
      console.warn('Failed to send verification email, but request was created');
    }

    res.status(201).json({
      message: 'Verification request sent successfully',
      verification: {
        id: verification._id,
        itemType: verification.itemType,
        verifierEmail: verification.verifierEmail,
        status: verification.status,
        expiresAt: verification.expiresAt
      }
    });

  } catch (error) {
    console.error('Verification request error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    res.status(500).json({ 
      message: 'Failed to create verification request', 
      error: error.message 
    });
  }
});

// Get verification details by token (public) - Enhanced for verifiers
router.get('/:token', async (req, res) => {
  try {
    const verification = await Verification.findOne({ 
      token: req.params.token,
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(404).json({ 
        message: 'Verification not found or expired' 
      });
    }

    // Get the actual item based on type
    const { item } = await getModelAndItem(verification.itemType, verification.itemId);

    if (!item) {
      return res.status(404).json({ 
        message: 'Associated item not found' 
      });
    }

    // Get student and verifier details
    const [student, verifier] = await Promise.all([
      User.findById(item.userId).select('name email institute'),
      User.findOne({ email: verification.verifierEmail }).select('name email institute')
    ]);

    // Log the view
    await new VerificationLog({
      verificationId: verification._id,
      action: 'VIEWED',
      actorEmail: verification.verifierEmail,
      metadata: { userAgent: req.get('User-Agent') }
    }).save();

    res.json({
      id: verification._id,
      student: {
        name: student.name,
        email: student.email,
        institute: student.institute
      },
      verifier: verifier ? {
        name: verifier.name,
        email: verifier.email,
        institute: verifier.institute
      } : {
        email: verification.verifierEmail
      },
      itemType: verification.itemType,
      item: {
        title: item.title || item.courseName || item.projectName,
        description: item.description,
        startDate: item.startDate,
        endDate: item.endDate,
        passingYear: item.passingYear,
        attachments: item.attachments || []
      },
      status: verification.status,
      requestedAt: verification.createdAt,
      comment: verification.comment,
      actedBy: verification.actedBy,
      actedAt: verification.actedAt,
      expiresAt: verification.expiresAt
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

    // Update the actual item as verified with verifier details
    const { Model } = await getModelAndItem(verification.itemType, verification.itemId);
    await Model.findByIdAndUpdate(verification.itemId, {
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: actorEmail.toLowerCase(),
      verifierComment: comment || ''
    });

    // Log the approval
    await new VerificationLog({
      verificationId: verification._id,
      action: 'APPROVED',
      actorEmail: actorEmail.toLowerCase(),
      metadata: { comment: comment || '' }
    }).save();

    res.json({
      message: `${verification.itemType.toLowerCase()} verified successfully`,
      verification: {
        id: verification._id,
        itemType: verification.itemType,
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

    // Update the actual item with rejection details (but keep verified as false)
    const { Model } = await getModelAndItem(verification.itemType, verification.itemId);
    await Model.findByIdAndUpdate(verification.itemId, {
      verifiedBy: actorEmail.toLowerCase(),
      verifierComment: comment || ''
    });

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
        itemType: verification.itemType,
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

// Get verification history for an item (owner only)
router.get('/history/:itemType/:itemId', requireAuth, async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    // Check if item belongs to user
    const { item } = await getModelAndItem(itemType, itemId, req.user._id);

    if (!item) {
      return res.status(404).json({ 
        message: `${itemType.toLowerCase()} not found` 
      });
    }

    const verifications = await Verification.find({
      itemId: itemId,
      itemType: itemType.toUpperCase()
    }).sort({ createdAt: -1 });

    res.json({ verifications });

  } catch (error) {
    console.error('Get verification history error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    res.status(500).json({ 
      message: 'Failed to fetch verification history', 
      error: error.message 
    });
  }
});

// Legacy route for backward compatibility (experiences only)
router.post('/request/:experienceId', requireAuth, async (req, res) => {
  req.params.itemType = 'EXPERIENCE';
  req.params.itemId = req.params.experienceId;
  return router.handle(req, res);
});

module.exports = router;
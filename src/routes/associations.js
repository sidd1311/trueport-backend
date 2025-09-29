const express = require('express');
const AssociationRequest = require('../models/AssociationRequest');
const User = require('../models/User');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Submit association request (Student requests to be associated with institute)
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { requestedRole, institute, requestMessage } = req.body;
    const student = req.user;

    // Validation
    if (!requestedRole || !institute) {
      return res.status(400).json({
        message: 'Role and institute are required'
      });
    }

    if (!['STUDENT', 'VERIFIER'].includes(requestedRole)) {
      return res.status(400).json({
        message: 'Role must be STUDENT or VERIFIER'
      });
    }

    if (institute.trim().length === 0) {
      return res.status(400).json({
        message: 'Institute name cannot be empty'
      });
    }

    // Check if user's role is already set permanently
    if (student.roleSetPermanently) {
      return res.status(400).json({
        message: 'Your role has already been set and cannot be changed'
      });
    }

    // Check if there are any verifiers at this institute
    const verifiersCount = await User.countDocuments({ 
      role: 'VERIFIER',
      institute: institute.trim()
    });

    if (verifiersCount === 0) {
      return res.status(404).json({
        message: 'No verifiers found at the specified institute. Please check the institute name or contact your institution.'
      });
    }

    // Check for existing pending request for this institute
    const existingRequest = await AssociationRequest.findOne({
      studentId: student._id,
      institute: institute.trim(),
      status: 'PENDING'
    });

    if (existingRequest) {
      return res.status(400).json({
        message: 'You already have a pending request for this institute'
      });
    }

    // Create association request (without specific verifier)
    const associationRequest = new AssociationRequest({
      studentId: student._id,
      studentEmail: student.email,
      studentName: student.name,
      verifierId: null, // No specific verifier
      verifierEmail: null,
      verifierName: null,
      institute: institute.trim(),
      requestedRole,
      requestMessage: requestMessage ? requestMessage.trim() : undefined
    });

    await associationRequest.save();

    // Update student's association status
    await User.findByIdAndUpdate(student._id, {
      associationStatus: 'PENDING'
    });

    res.status(201).json({
      message: 'Association request submitted successfully',
      request: {
        id: associationRequest._id,
        institute: institute.trim(),
        requestedRole,
        status: 'PENDING',
        requestedAt: associationRequest.requestedAt,
        availableVerifiers: verifiersCount
      }
    });

  } catch (error) {
    console.error('Association request error:', error);
    res.status(500).json({
      message: 'Failed to submit association request',
      error: error.message
    });
  }
});

// Get pending requests for verifier's institute
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const verifier = req.user;

    if (verifier.role !== 'VERIFIER') {
      return res.status(403).json({
        message: 'Only verifiers can view pending requests'
      });
    }

    if (!verifier.institute) {
      return res.status(400).json({
        message: 'Verifier must have an associated institute'
      });
    }

    const requests = await AssociationRequest.findPendingForInstitute(verifier.institute);

    const formattedRequests = requests.map(request => ({
      id: request._id,
      student: {
        id: request.studentId._id,
        name: request.studentName,
        email: request.studentEmail,
        profilePicture: request.studentId.profilePicture
      },
      requestedRole: request.requestedRole,
      institute: request.institute,
      requestMessage: request.requestMessage,
      requestedAt: request.requestedAt,
      requestAge: request.requestAge,
      expiresAt: request.expiresAt
    }));

    res.json({
      institute: verifier.institute,
      requests: formattedRequests,
      count: formattedRequests.length
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      message: 'Failed to fetch pending requests',
      error: error.message
    });
  }
});

// Get user's association status and requests
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const user = req.user;

    const pendingRequests = await AssociationRequest.findUserPendingRequests(user._id);

    const allRequests = await AssociationRequest.find({
      studentId: user._id
    }).populate('verifierId', 'name email institute').sort({ createdAt: -1 });

    const formattedRequests = allRequests.map(request => ({
      id: request._id,
      verifier: request.verifierId ? {
        id: request.verifierId._id,
        name: request.verifierName,
        email: request.verifierEmail,
        institute: request.verifierId.institute
      } : {
        name: request.verifierName || 'Any Verifier',
        email: request.verifierEmail || 'N/A',
        institute: request.institute
      },
      requestedRole: request.requestedRole,
      institute: request.institute,
      status: request.status,
      requestMessage: request.requestMessage,
      verifierResponse: request.verifierResponse,
      requestedAt: request.requestedAt,
      respondedAt: request.respondedAt,
      isExpired: request.isExpired(),
      approvedBy: request.approvedBy
    }));

    res.json({
      associationStatus: user.associationStatus,
      roleSetPermanently: user.roleSetPermanently,
      currentRole: user.role,
      currentInstitute: user.institute,
      approvedBy: user.approvedBy,
      approvedAt: user.approvedAt,
      requests: formattedRequests,
      pendingCount: pendingRequests.length
    });

  } catch (error) {
    console.error('Get user requests error:', error);
    res.status(500).json({
      message: 'Failed to fetch association requests',
      error: error.message
    });
  }
});

// Approve or reject association request (Verifier action)
router.put('/:requestId/respond', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, response } = req.body; // action: 'approve' or 'reject'
    const verifier = req.user;

    if (verifier.role !== 'VERIFIER') {
      return res.status(403).json({
        message: 'Only verifiers can respond to association requests'
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const associationRequest = await AssociationRequest.findOne({
      _id: requestId,
      institute: verifier.institute, // Match by institute instead of specific verifier
      status: 'PENDING'
    });

    if (!associationRequest) {
      return res.status(404).json({
        message: 'Association request not found or already processed'
      });
    }

    if (associationRequest.isExpired()) {
      return res.status(400).json({
        message: 'Association request has expired'
      });
    }

    const student = await User.findById(associationRequest.studentId);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found'
      });
    }

    // Check if student's role is already set permanently
    if (student.roleSetPermanently) {
      await AssociationRequest.findByIdAndUpdate(requestId, {
        status: 'REJECTED',
        verifierResponse: 'Student role already set permanently',
        respondedAt: new Date()
      });

      return res.status(400).json({
        message: 'Student role has already been set permanently'
      });
    }

    const now = new Date();
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update association request
    await AssociationRequest.findByIdAndUpdate(requestId, {
      status: newStatus,
      verifierResponse: response ? response.trim() : undefined,
      respondedAt: now,
      approvedBy: verifier._id, // Track which verifier responded
      verifierId: verifier._id, // Set the verifier who handled the request
      verifierEmail: verifier.email,
      verifierName: verifier.name
    });

    if (action === 'approve') {
      // Update student's profile with approved association
      await User.findByIdAndUpdate(student._id, {
        role: associationRequest.requestedRole,
        institute: associationRequest.institute,
        associationStatus: 'APPROVED',
        roleSetPermanently: true, // Role becomes permanent once approved
        roleSetAt: now,
        approvedBy: verifier._id,
        approvedAt: now,
        profileSetupComplete: true
      });

      res.json({
        message: `Association request ${action}d successfully`,
        student: {
          name: student.name,
          email: student.email,
          newRole: associationRequest.requestedRole,
          institute: associationRequest.institute
        }
      });
    } else {
      // Update student's association status to rejected
      await User.findByIdAndUpdate(student._id, {
        associationStatus: 'REJECTED'
      });

      res.json({
        message: `Association request ${action}d`,
        reason: response
      });
    }

  } catch (error) {
    console.error('Respond to association request error:', error);
    res.status(500).json({
      message: 'Failed to respond to association request',
      error: error.message
    });
  }
});

// Cancel pending association request (Student action)
router.delete('/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const student = req.user;

    const associationRequest = await AssociationRequest.findOne({
      _id: requestId,
      studentId: student._id,
      status: 'PENDING'
    });

    if (!associationRequest) {
      return res.status(404).json({
        message: 'Pending association request not found'
      });
    }

    await AssociationRequest.findByIdAndDelete(requestId);

    // Check if user has any other pending requests
    const otherPendingRequests = await AssociationRequest.countDocuments({
      studentId: student._id,
      status: 'PENDING'
    });

    if (otherPendingRequests === 0) {
      await User.findByIdAndUpdate(student._id, {
        associationStatus: 'NONE'
      });
    }

    res.json({
      message: 'Association request cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel association request error:', error);
    res.status(500).json({
      message: 'Failed to cancel association request',
      error: error.message
    });
  }
});

// Get available verifiers for association (Students can browse verifiers)
router.get('/verifiers', requireAuth, async (req, res) => {
  try {
    const { institute, page = 1, limit = 10, search } = req.query;
    const student = req.user;

    if (student.roleSetPermanently) {
      return res.status(400).json({
        message: 'Your role has already been set permanently'
      });
    }

    let query = { role: 'VERIFIER' };

    if (institute) {
      query.institute = new RegExp(institute, 'i');
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { institute: new RegExp(search, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [verifiers, total] = await Promise.all([
      User.find(query)
        .select('name email institute bio profilePicture createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Check if student has pending requests with any of these verifiers
    const verifierIds = verifiers.map(v => v._id);
    const pendingRequests = await AssociationRequest.find({
      studentId: student._id,
      verifierId: { $in: verifierIds },
      status: 'PENDING'
    });

    const pendingVerifierIds = pendingRequests.map(req => req.verifierId.toString());

    const formattedVerifiers = verifiers.map(verifier => ({
      id: verifier._id,
      name: verifier.name,
      email: verifier.email,
      institute: verifier.institute,
      bio: verifier.bio,
      profilePicture: verifier.profilePicture,
      joinedAt: verifier.createdAt,
      hasPendingRequest: pendingVerifierIds.includes(verifier._id.toString())
    }));

    res.json({
      verifiers: formattedVerifiers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get verifiers error:', error);
    res.status(500).json({
      message: 'Failed to fetch verifiers',
      error: error.message
    });
  }
});

module.exports = router;
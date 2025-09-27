const express = require('express');
const User = require('../models/User');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const GithubProject = require('../models/GithubProject');
const Verification = require('../models/Verification');
const VerificationLog = require('../models/VerificationLog');
const { requireAuth } = require('../middlewares/auth');
const { sendVerificationEmail, sendVerificationDecisionEmail } = require('../utils/email');

const router = express.Router();

// Middleware to ensure user is a verifier
const requireVerifier = (req, res, next) => {
  if (req.user.role !== 'VERIFIER') {
    return res.status(403).json({ 
      message: 'Access denied. Verifier role required.' 
    });
  }
  next();
};

// Middleware to check same institution
const requireSameInstitute = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (studentId) {
      const student = await User.findById(studentId);
      if (!student || student.institute !== req.user.institute) {
        return res.status(403).json({ 
          message: 'Access denied. Different institution.' 
        });
      }
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to get model based on item type
const getModel = (itemType) => {
  switch (itemType.toUpperCase()) {
    case 'EXPERIENCE': return Experience;
    case 'EDUCATION': return Education;
    case 'GITHUB_PROJECT': return GithubProject;
    default: throw new Error('Invalid item type');
  }
};

// Get verifier dashboard statistics
router.get('/stats', requireAuth, requireVerifier, async (req, res) => {
  try {
    const verifierInstitute = req.user.institute;
    
    if (!verifierInstitute) {
      return res.status(400).json({ 
        message: 'Verifier must have an institute associated' 
      });
    }

    // Get stats for this verifier's email
    const [pendingVerifications, studentsInInstitute, completedVerifications, totalRequests] = await Promise.all([
      Verification.countDocuments({
        verifierEmail: req.user.email,
        status: 'PENDING',
        expiresAt: { $gt: new Date() }
      }),
      User.countDocuments({
        institute: verifierInstitute,
        role: 'STUDENT'
      }),
      Verification.countDocuments({
        actedBy: req.user.email,
        status: { $in: ['APPROVED', 'REJECTED'] }
      }),
      Verification.countDocuments({
        verifierEmail: req.user.email
      })
    ]);

    res.json({
      pendingVerifications,
      studentsInInstitute,
      completedVerifications,
      totalRequests
    });

  } catch (error) {
    console.error('Get verifier stats error:', error);
    res.status(500).json({
      message: 'Failed to fetch verifier statistics',
      error: error.message
    });
  }
});

// Get quick list of pending requests for dashboard
router.get('/pending-requests', requireAuth, requireVerifier, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const verifications = await Verification.find({
      verifierEmail: req.user.email,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    // Populate with actual items and student details
    const requests = await Promise.all(
      verifications.map(async (verification) => {
        try {
          const Model = getModel(verification.itemType);
          const item = await Model.findById(verification.itemId).populate('userId', 'name email');

          if (!item || !item.userId) return null;

          return {
            _id: verification._id,
            studentId: item.userId._id,
            studentName: item.userId.name,
            studentEmail: item.userId.email,
            type: verification.itemType,
            title: item.title || item.courseName || item.projectName,
            description: item.description,
            createdAt: verification.createdAt
          };
        } catch (error) {
          console.error('Error processing verification:', error);
          return null;
        }
      })
    );

    const filteredRequests = requests.filter(req => req !== null);

    res.json({
      requests: filteredRequests
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      message: 'Failed to fetch pending requests',
      error: error.message
    });
  }
});

// Get pending verification requests
router.get('/requests', requireAuth, requireVerifier, async (req, res) => {
  try {
    const {
      status = 'PENDING',
      itemType,
      page = 1,
      limit = 10,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query for verifications
    const verificationQuery = {
      verifierEmail: req.user.email
    };

    if (status !== 'ALL') {
      verificationQuery.status = status.toUpperCase();
    }

    if (status === 'PENDING') {
      verificationQuery.expiresAt = { $gt: new Date() };
    }

    if (itemType) {
      verificationQuery.itemType = itemType.toUpperCase();
    }

    let verifications = await Verification.find(verificationQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Populate with actual items and student details
    const requests = await Promise.all(
      verifications.map(async (verification) => {
        try {
          const Model = getModel(verification.itemType);
          const item = await Model.findById(verification.itemId).populate('userId', 'name email institute');

          if (!item || !item.userId) return null;

          // Apply search filter if provided
          if (search) {
            const searchLower = search.toLowerCase();
            const studentName = item.userId.name.toLowerCase();
            const itemTitle = (item.title || item.courseName || item.projectName || '').toLowerCase();
            
            if (!studentName.includes(searchLower) && !itemTitle.includes(searchLower)) {
              return null;
            }
          }

          return {
            id: verification._id,
            student: {
              id: item.userId._id,
              name: item.userId.name,
              email: item.userId.email,
              institute: item.userId.institute
            },
            itemType: verification.itemType,
            itemId: verification.itemId,
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
            verifierEmail: verification.verifierEmail,
            comment: verification.comment,
            actedAt: verification.actedAt
          };
        } catch (error) {
          console.error('Error processing verification:', error);
          return null;
        }
      })
    );

    const filteredRequests = requests.filter(req => req !== null);
    const total = await Verification.countDocuments(verificationQuery);

    res.json({
      requests: filteredRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get verification requests error:', error);
    res.status(500).json({
      message: 'Failed to fetch verification requests',
      error: error.message
    });
  }
});

// Get single verification request detail
router.get('/request/:requestId', requireAuth, requireVerifier, async (req, res) => {
  try {
    const { requestId } = req.params;

    const verification = await Verification.findOne({
      _id: requestId,
      verifierEmail: req.user.email
    });

    if (!verification) {
      return res.status(404).json({
        message: 'Verification request not found'
      });
    }

    // Get the actual item and student details
    const Model = getModel(verification.itemType);
    const item = await Model.findById(verification.itemId).populate('userId', 'name email institute');

    if (!item || !item.userId) {
      return res.status(404).json({
        message: 'Associated item not found'
      });
    }

    // Get verification logs
    const logs = await VerificationLog.find({
      verificationId: verification._id
    }).sort({ createdAt: 1 });

    const request = {
      _id: verification._id,
      status: verification.status,
      verifierEmail: verification.verifierEmail,
      comment: verification.comment,
      createdAt: verification.createdAt,
      actedAt: verification.actedAt,
      item: {
        id: item._id,
        type: verification.itemType,
        title: item.title || item.courseName || item.projectName,
        description: item.description,
        startDate: item.startDate,
        endDate: item.endDate,
        passingYear: item.passingYear,
        files: item.attachments || []
      },
      student: {
        id: item.userId._id,
        name: item.userId.name,
        email: item.userId.email,
        institute: item.userId.institute
      },
      logs: logs.map(log => ({
        action: log.action,
        actionBy: log.actorEmail,
        createdAt: log.createdAt,
        metadata: log.metadata
      }))
    };

    res.json({ request });

  } catch (error) {
    console.error('Get verification request error:', error);
    res.status(500).json({
      message: 'Failed to fetch verification request',
      error: error.message
    });
  }
});

// Approve verification request
router.post('/approve/:requestId', requireAuth, requireVerifier, async (req, res) => {
  try {
    const { comment } = req.body;
    const { requestId } = req.params;

    const verification = await Verification.findOne({
      _id: requestId,
      verifierEmail: req.user.email,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(404).json({
        message: 'Verification request not found or already processed'
      });
    }

    // Get the item to verify student belongs to same institute
    const Model = getModel(verification.itemType);
    const item = await Model.findById(verification.itemId).populate('userId', 'institute name email');

    if (!item || item.userId.institute !== req.user.institute) {
      return res.status(403).json({
        message: 'Can only verify items from students in your institution'
      });
    }

    // Update verification
    verification.status = 'APPROVED';
    verification.comment = comment || '';
    verification.actedBy = req.user.email;
    verification.actedAt = new Date();
    await verification.save();

    // Update the actual item as verified
    await Model.findByIdAndUpdate(verification.itemId, {
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: req.user.email,
      verifierComment: comment || ''
    });

    // Log the approval
    await new VerificationLog({
      verificationId: verification._id,
      action: 'APPROVED',
      actorEmail: req.user.email,
      metadata: { comment: comment || '' }
    }).save();

    // Send notification email to student
    const itemTitle = item.title || item.courseName || item.projectName || 'Item';
    try {
      await sendVerificationDecisionEmail(
        item.userId.email,
        itemTitle,
        verification.itemType,
        'APPROVED',
        comment,
        req.user.name
      );
    } catch (emailError) {
      console.warn('Failed to send approval notification email:', emailError);
    }

    res.json({
      ok: true,
      requestId: verification._id,
      status: 'APPROVED'
    });

  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({
      message: 'Failed to approve verification',
      error: error.message
    });
  }
});

// Reject verification request
router.post('/reject/:requestId', requireAuth, requireVerifier, async (req, res) => {
  try {
    const { comment } = req.body;
    const { requestId } = req.params;

    const verification = await Verification.findOne({
      _id: requestId,
      verifierEmail: req.user.email,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(404).json({
        message: 'Verification request not found or already processed'
      });
    }

    // Get the item to verify student belongs to same institute
    const Model = getModel(verification.itemType);
    const item = await Model.findById(verification.itemId).populate('userId', 'institute name email');

    if (!item || item.userId.institute !== req.user.institute) {
      return res.status(403).json({
        message: 'Can only verify items from students in your institution'
      });
    }

    // Update verification
    verification.status = 'REJECTED';
    verification.comment = comment || '';
    verification.actedBy = req.user.email;
    verification.actedAt = new Date();
    await verification.save();

    // Update the actual item with rejection details
    await Model.findByIdAndUpdate(verification.itemId, {
      verifiedBy: req.user.email,
      verifierComment: comment || ''
    });

    // Log the rejection
    await new VerificationLog({
      verificationId: verification._id,
      action: 'REJECTED',
      actorEmail: req.user.email,
      metadata: { comment: comment || '' }
    }).save();

    // Send notification email to student
    const itemTitle = item.title || item.courseName || item.projectName || 'Item';
    try {
      await sendVerificationDecisionEmail(
        item.userId.email,
        itemTitle,
        verification.itemType,
        'REJECTED',
        comment,
        req.user.name
      );
    } catch (emailError) {
      console.warn('Failed to send rejection notification email:', emailError);
    }

    res.json({
      ok: true,
      requestId: verification._id,
      status: 'REJECTED'
    });

  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({
      message: 'Failed to reject verification',
      error: error.message
    });
  }
});

// Get students from same institution
router.get('/institute-students', requireAuth, requireVerifier, async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 12
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const verifierInstitute = req.user.institute;

    if (!verifierInstitute) {
      return res.status(400).json({
        message: 'Verifier must have an institute associated'
      });
    }

    // Build query for students
    const studentQuery = {
      institute: verifierInstitute,
      role: 'STUDENT'
    };

    if (search) {
      studentQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profileJson.skills': { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(studentQuery)
      .select('name email institute profileJson createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get stats for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const [
          totalExperiences,
          verifiedExperiences,
          totalEducation,
          verifiedEducation,
          totalProjects,
          verifiedProjects
        ] = await Promise.all([
          Experience.countDocuments({ userId: student._id }),
          Experience.countDocuments({ userId: student._id, verified: true }),
          Education.countDocuments({ userId: student._id }),
          Education.countDocuments({ userId: student._id, verified: true }),
          GithubProject.countDocuments({ userId: student._id }),
          GithubProject.countDocuments({ userId: student._id, verified: true })
        ]);

        return {
          _id: student._id,
          name: student.name,
          email: student.email,
          createdAt: student.createdAt,
          stats: {
            experiences: totalExperiences,
            education: totalEducation,
            projects: totalProjects,
            verified: verifiedExperiences + verifiedEducation + verifiedProjects,
            total: totalExperiences + totalEducation + totalProjects
          }
        };
      })
    );

    const filteredStudents = studentsWithStats.filter(student => student !== null);
    const total = await User.countDocuments(studentQuery);

    res.json({
      students: filteredStudents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// Get single student portfolio view
router.get('/student/:studentId', requireAuth, requireVerifier, requireSameInstitute, async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId).select('name email institute profileJson createdAt');

    if (!student) {
      return res.status(404).json({
        message: 'Student not found'
      });
    }

    // Get all items for this student
    const [experiences, education, projects] = await Promise.all([
      Experience.find({ userId: studentId }).select('title description verified verifiedBy verifiedAt createdAt'),
      Education.find({ userId: studentId }).select('courseName description verified verifiedBy verifiedAt createdAt'),
      GithubProject.find({ userId: studentId }).select('projectName description verified verifiedBy verifiedAt createdAt')
    ]);

    // Format items
    const items = [
      ...experiences.map(exp => ({
        type: 'EXPERIENCE',
        id: exp._id,
        title: exp.title,
        description: exp.description,
        verified: exp.verified,
        verifier: exp.verifiedBy,
        verifiedAt: exp.verifiedAt,
        createdAt: exp.createdAt
      })),
      ...education.map(edu => ({
        type: 'EDUCATION',
        id: edu._id,
        title: edu.courseName,
        description: edu.description,
        verified: edu.verified,
        verifier: edu.verifiedBy,
        verifiedAt: edu.verifiedAt,
        createdAt: edu.createdAt
      })),
      ...projects.map(proj => ({
        type: 'GITHUB_PROJECT',
        id: proj._id,
        title: proj.projectName,
        description: proj.description,
        verified: proj.verified,
        verifier: proj.verifiedBy,
        verifiedAt: proj.verifiedAt,
        createdAt: proj.createdAt
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        bio: student.profileJson?.bio || '',
        institute: student.institute,
        createdAt: student.createdAt
      },
      items
    });

  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      message: 'Failed to fetch student details',
      error: error.message
    });
  }
});

// Get analytics data
router.get('/analytics', requireAuth, requireVerifier, async (req, res) => {
  try {
    const { from, to } = req.query;

    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = to ? new Date(to) : new Date();

    // Aggregate data by day
    const pipeline = [
      {
        $match: {
          verifierEmail: req.user.email,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          },
          requested: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "APPROVED"] }, 1, 0] }
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "REJECTED"] }, 1, 0] }
          }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ];

    const results = await Verification.aggregate(pipeline);

    const byDay = results.map(result => ({
      date: result._id.date,
      requested: result.requested,
      approved: result.approved,
      rejected: result.rejected
    }));

    res.json({ byDay });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Resend verification notification
router.post('/notify-resend/:requestId', requireAuth, requireVerifier, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { email } = req.body;

    const verification = await Verification.findOne({
      _id: requestId,
      verifierEmail: req.user.email,
      status: 'PENDING',
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      return res.status(404).json({
        message: 'Verification request not found or expired'
      });
    }

    // Get the item details
    const Model = getModel(verification.itemType);
    const item = await Model.findById(verification.itemId).populate('userId', 'name email');

    if (!item) {
      return res.status(404).json({
        message: 'Associated item not found'
      });
    }

    // Send email (use override email if provided, otherwise original verifier email)
    const targetEmail = email || verification.verifierEmail;
    const itemTitle = item.title || item.courseName || item.projectName || 'Item';
    
    const emailSent = await sendVerificationEmail(
      targetEmail,
      verification.token,
      itemTitle,
      item.userId.name,
      verification.itemType
    );

    if (!emailSent) {
      return res.status(500).json({
        message: 'Failed to send verification email'
      });
    }

    // Log the resend action
    await new VerificationLog({
      verificationId: verification._id,
      action: 'EMAIL_RESENT',
      actorEmail: req.user.email,
      metadata: { targetEmail, originalEmail: verification.verifierEmail }
    }).save();

    const verificationLink = `${process.env.FRONTEND_URL}/verify/${verification.token}`;

    res.json({
      ok: true,
      link: verificationLink
    });

  } catch (error) {
    console.error('Resend notification error:', error);
    res.status(500).json({
      message: 'Failed to resend notification',
      error: error.message
    });
  }
});

// Get institution statistics
router.get('/institute/stats', requireAuth, requireVerifier, async (req, res) => {
  try {
    const verifierInstitute = req.user.institute;

    if (!verifierInstitute) {
      return res.status(400).json({
        message: 'Verifier must have an institute associated'
      });
    }

    // Get basic counts
    const [totalStudents, totalVerifiers] = await Promise.all([
      User.countDocuments({ institute: verifierInstitute, role: 'STUDENT' }),
      User.countDocuments({ institute: verifierInstitute, role: 'VERIFIER' })
    ]);

    // Get all verifier emails from this institute
    const instituteVerifiers = await User.find({
      institute: verifierInstitute,
      role: 'VERIFIER'
    }).select('email');

    const verifierEmails = instituteVerifiers.map(v => v.email);

    // Get verification stats for this institute
    const [totalRequests, approved, rejected, pending] = await Promise.all([
      Verification.countDocuments({ verifierEmail: { $in: verifierEmails } }),
      Verification.countDocuments({ verifierEmail: { $in: verifierEmails }, status: 'APPROVED' }),
      Verification.countDocuments({ verifierEmail: { $in: verifierEmails }, status: 'REJECTED' }),
      Verification.countDocuments({ 
        verifierEmail: { $in: verifierEmails }, 
        status: 'PENDING',
        expiresAt: { $gt: new Date() }
      })
    ]);

    // Get monthly stats for last 6 months
    const monthlyStats = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

      const [monthRequests, monthApproved, monthRejected, monthPending] = await Promise.all([
        Verification.countDocuments({
          verifierEmail: { $in: verifierEmails },
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }),
        Verification.countDocuments({
          verifierEmail: { $in: verifierEmails },
          status: 'APPROVED',
          actedAt: { $gte: startOfMonth, $lte: endOfMonth }
        }),
        Verification.countDocuments({
          verifierEmail: { $in: verifierEmails },
          status: 'REJECTED',
          actedAt: { $gte: startOfMonth, $lte: endOfMonth }
        }),
        Verification.countDocuments({
          verifierEmail: { $in: verifierEmails },
          status: 'PENDING',
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        })
      ]);

      monthlyStats.push({
        month: startOfMonth.toISOString().substring(0, 7), // YYYY-MM format
        requests: monthRequests,
        approved: monthApproved,
        rejected: monthRejected,
        pending: monthPending
      });
    }

    res.json({
      instituteName: verifierInstitute,
      totalStudents,
      totalVerifiers,
      verificationStats: {
        totalRequests,
        approved,
        rejected,
        pending
      },
      monthlyStats
    });

  } catch (error) {
    console.error('Get institute stats error:', error);
    res.status(500).json({
      message: 'Failed to fetch institute statistics',
      error: error.message
    });
  }
});

module.exports = router;
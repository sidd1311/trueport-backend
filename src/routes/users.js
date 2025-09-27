const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      user: req.user.toJSON()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch profile', 
      error: error.message 
    });
  }
});

// Update user profile
router.put('/me', requireAuth, async (req, res) => {
  try {
    const updates = {};
    const allowedUpdates = ['name', 'githubUsername', 'bio', 'institute', 'profileJson'];
    
    // Only include allowed fields
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate name if provided
    if (updates.name && (!updates.name.trim() || updates.name.length > 100)) {
      return res.status(400).json({ 
        message: 'Name must be between 1 and 100 characters' 
      });
    }

    // Validate bio if provided
    if (updates.bio && updates.bio.length > 500) {
      return res.status(400).json({ 
        message: 'Bio must be less than 500 characters' 
      });
    }

    // Validate institute if provided
    if (updates.institute && updates.institute.length > 200) {
      return res.status(400).json({ 
        message: 'Institute name must be less than 200 characters' 
      });
    }

    // Validate GitHub username if provided
    if (updates.githubUsername !== undefined) {
      if (!updates.githubUsername || !updates.githubUsername.trim()) {
        return res.status(400).json({ 
          message: 'GitHub username is required and cannot be empty' 
        });
      }
      if (updates.githubUsername.length > 50) {
        return res.status(400).json({ 
          message: 'GitHub username must be less than 50 characters' 
        });
      }
      // Trim the username
      updates.githubUsername = updates.githubUsername.trim();
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: messages 
      });
    }

    if (error.code === 11000 && error.keyPattern?.githubUsername) {
      return res.status(400).json({ 
        message: 'GitHub username already taken' 
      });
    }

    res.status(500).json({ 
      message: 'Failed to update profile', 
      error: error.message 
    });
  }
});

// Get users by institute (MOVE THIS UP - SPECIFIC ROUTE FIRST)
router.get('/institute/:instituteName', async (req, res) => {
  try {
    const { instituteName } = req.params;
    const { role, page = 1, limit = 10 } = req.query;

    const query = {
      institute: { $regex: instituteName, $options: 'i' }
    };

    if (role && ['STUDENT', 'VERIFIER', 'ADMIN'].includes(role.toUpperCase())) {
      query.role = role.toUpperCase();
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('name email githubUsername bio institute role createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      institute: instituteName,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get users by institute error:', error);
    res.status(500).json({
      message: 'Failed to fetch users by institute',
      error: error.message
    });
  }
});

// Update password
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(req.user._id);
    
    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    await user.save();

    res.json({
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ 
      message: 'Failed to update password', 
      error: error.message 
    });
  }
});

// Get verifiers from same institution (for verification requests)
router.get('/institute-verifiers', requireAuth, async (req, res) => {
  try {
    const userInstitute = req.user.institute;
    const { search, department, page = 1, limit = 20 } = req.query;

    if (!userInstitute) {
      return res.status(400).json({
        message: 'User must have an institute associated to find verifiers'
      });
    }

    // Build search query
    const query = {
      institute: userInstitute,
      role: 'VERIFIER'
    };

    // Add search filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profileJson.department': { $regex: search, $options: 'i' } },
        { 'profileJson.designation': { $regex: search, $options: 'i' } }
      ];
    }

    if (department) {
      query['profileJson.department'] = { $regex: department, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get verifiers with pagination
    const [verifiers, total] = await Promise.all([
      User.find(query)
        .select('name email profileJson createdAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Get verification stats for each verifier (optional performance enhancement)
    const verifiersWithStats = await Promise.all(
      verifiers.map(async (verifier) => {
        const verificationsCount = await require('../models/Verification').countDocuments({
          verifierEmail: verifier.email,
          status: { $in: ['APPROVED', 'REJECTED'] }
        });

        return {
          id: verifier._id,
          name: verifier.name,
          email: verifier.email,
          bio: verifier.profileJson?.bio || '',
          department: verifier.profileJson?.department || '',
          designation: verifier.profileJson?.designation || 'Verifier',
          expertise: verifier.profileJson?.expertise || [],
          verificationsCompleted: verificationsCount,
          joinedAt: verifier.createdAt,
          isActive: verifier.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Active in last 30 days
        };
      })
    );

    res.json({
      institute: userInstitute,
      verifiers: verifiersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get institute verifiers error:', error);
    res.status(500).json({
      message: 'Failed to fetch institute verifiers',
      error: error.message
    });
  }
});

module.exports = router;
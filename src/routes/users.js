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

// Get user by ID (public profile info only)
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('name email githubUsername bio institute profileJson createdAt role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Get user error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    res.status(500).json({ 
      message: 'Failed to fetch user', 
      error: error.message 
    });
  }
});

// Get users by institute
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

module.exports = router;
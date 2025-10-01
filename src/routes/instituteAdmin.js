const express = require('express');
const InstituteAdmin = require('../models/InstituteAdmin');
const Institution = require('../models/Institution');
const User = require('../models/User');
const AssociationRequest = require('../models/AssociationRequest');
const { generateAdminToken, requireInstituteAdmin, requirePermission } = require('../middlewares/adminAuth');
const { generatePassword } = require('../utils/passwordGenerator');
const { sendWelcomeEmailWithCredentials } = require('../utils/email');

const router = express.Router();

// Institute Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const admin = await InstituteAdmin.findOne({ email: email.toLowerCase() });
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!admin.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    if (admin.isLocked) {
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to too many failed attempts' 
      });
    }

    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      await admin.incLoginAttempts();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    if (admin.loginAttempts > 0) {
      await admin.resetLoginAttempts();
    }

    // Update last login
    await admin.updateLastLogin();

    const token = generateAdminToken({
      adminId: admin._id,
      email: admin.email,
      role: admin.role,
      adminType: 'INSTITUTE_ADMIN',
      institution: admin.institution
    });

    res.json({
      message: 'Login successful',
      token,
      admin: admin.toJSON(),
    });

  } catch (error) {
    console.error('Institute admin login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get Institute Admin Profile
router.get('/me', requireInstituteAdmin, (req, res) => {
  res.json({
    admin: req.admin.toJSON()
  });
});

// Update Institute Admin Profile
router.put('/me', requireInstituteAdmin, async (req, res) => {
  try {
    const updates = {};
    const allowedUpdates = ['name', 'phone', 'profilePicture'];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    updates.updatedAt = new Date();

    const admin = await InstituteAdmin.findByIdAndUpdate(
      req.admin._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      admin: admin.toJSON()
    });

  } catch (error) {
    console.error('Update institute admin profile error:', error);
    res.status(500).json({
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Change Institute Admin Password
router.put('/change-password', requireInstituteAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters long'
      });
    }

    const isCurrentPasswordValid = await req.admin.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    req.admin.passwordHash = newPassword;
    await req.admin.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change institute admin password error:', error);
    res.status(500).json({
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Get Institute Information
router.get('/institution', requireInstituteAdmin, async (req, res) => {
  try {
    const institution = await Institution.findOne({ name: req.admin.institution });
    
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    res.json({
      institution
    });

  } catch (error) {
    console.error('Get institution error:', error);
    res.status(500).json({
      message: 'Failed to fetch institution details',
      error: error.message
    });
  }
});

// Get Institute Users
router.get('/users', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, associationStatus } = req.query;
    
    let query = { institute: req.admin.institution };
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { githubUsername: new RegExp(search, 'i') }
      ];
    }

    if (role) {
      query.role = role;
    }

    if (associationStatus) {
      query.associationStatus = associationStatus;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash -githubToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('approvedBy', 'name email'),
      User.countDocuments(query)
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get institute users error:', error);
    res.status(500).json({
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get Single User Details
router.get('/users/:userId', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ 
      _id: userId, 
      institute: req.admin.institution 
    })
    .select('-passwordHash -githubToken')
    .populate('approvedBy', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found in your institution' });
    }

    // Get user's association requests
    const associationRequests = await AssociationRequest.find({ 
      studentId: userId 
    }).sort({ createdAt: -1 });

    res.json({
      user: user.toJSON(),
      associationRequests
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
});

// Update User Role (Admin action)
router.put('/users/:userId/role', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;

    if (!['STUDENT', 'VERIFIER'].includes(newRole)) {
      return res.status(400).json({
        message: 'Role must be STUDENT or VERIFIER'
      });
    }

    const user = await User.findOne({ 
      _id: userId, 
      institute: req.admin.institution 
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found in your institution' });
    }

    // Check if role is already set permanently
    if (user.roleSetPermanently) {
      return res.status(400).json({
        message: 'User role is already set permanently and cannot be changed'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        role: newRole,
        roleSetPermanently: true,
        roleSetAt: new Date(),
        approvedBy: req.admin._id,
        approvedAt: new Date(),
        associationStatus: 'APPROVED',
        profileSetupComplete: true
      },
      { new: true, runValidators: true }
    ).select('-passwordHash -githubToken');

    // Update institution stats
    await Institution.updateStats(req.admin.institution);

    res.json({
      message: `User role updated to ${newRole} successfully`,
      user: updatedUser.toJSON()
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// Add New User (Student or Verifier)
router.post('/users', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { name, email, password, role, bio, githubUsername } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: 'Name, email, password, and role are required'
      });
    }

    if (!['STUDENT', 'VERIFIER'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be STUDENT or VERIFIER'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password, // Will be hashed by pre-save middleware
      role,
      institute: req.admin.institution,
      bio: bio ? bio.trim() : undefined,
      githubUsername: githubUsername ? githubUsername.trim() : undefined,
      profileSetupComplete: true,
      roleSetPermanently: true,
      roleSetAt: new Date(),
      associationStatus: 'APPROVED',
      approvedBy: req.admin._id,
      approvedAt: new Date()
    });

    await newUser.save();

    // Update institution stats
    await Institution.updateStats(req.admin.institution);

    res.status(201).json({
      message: `${role} created successfully`,
      user: newUser.toJSON()
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// Update User Details (Admin action)
router.put('/users/:userId', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, bio, githubUsername, role } = req.body;

    const user = await User.findOne({ 
      _id: userId, 
      institute: req.admin.institution 
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found in your institution' });
    }

    const updates = {};

    // Validate and set updates
    if (name !== undefined) {
      if (!name.trim() || name.length > 100) {
        return res.status(400).json({
          message: 'Name must be between 1 and 100 characters'
        });
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json({ message: 'Email cannot be empty' });
      }
      
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase().trim(),
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          message: 'Email is already taken by another user'
        });
      }
      
      updates.email = email.toLowerCase().trim();
    }

    if (bio !== undefined) {
      if (bio.length > 500) {
        return res.status(400).json({
          message: 'Bio must be less than 500 characters'
        });
      }
      updates.bio = bio.trim();
    }

    if (githubUsername !== undefined) {
      if (githubUsername.trim() && githubUsername.length > 50) {
        return res.status(400).json({
          message: 'GitHub username must be less than 50 characters'
        });
      }
      updates.githubUsername = githubUsername.trim() || null;
    }

    if (role !== undefined) {
      if (!['STUDENT', 'VERIFIER'].includes(role)) {
        return res.status(400).json({
          message: 'Role must be STUDENT or VERIFIER'
        });
      }
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-passwordHash -githubToken');

    // Update institution stats if role changed
    if (role && role !== user.role) {
      await Institution.updateStats(req.admin.institution);
    }

    res.json({
      message: 'User updated successfully',
      user: updatedUser.toJSON()
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Reset User Password (Admin action)
router.put('/users/:userId/reset-password', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findOne({ 
      _id: userId, 
      institute: req.admin.institution 
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found in your institution' });
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save middleware
    await user.save();

    res.json({
      message: 'User password reset successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({
      message: 'Failed to reset user password',
      error: error.message
    });
  }
});

// Remove User from Institution
router.delete('/users/:userId', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { action = 'remove' } = req.body; // 'remove' or 'delete'

    const user = await User.findOne({ 
      _id: userId, 
      institute: req.admin.institution 
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found in your institution' });
    }

    if (action === 'delete') {
      // Permanently delete user (use with caution)
      await User.findByIdAndDelete(userId);
      
      // Remove any pending association requests
      await AssociationRequest.deleteMany({ 
        studentId: userId,
        institute: req.admin.institution 
      });

      res.json({ 
        message: 'User deleted permanently' 
      });
    } else {
      // Default: Remove from institution but keep user account
      await User.findByIdAndUpdate(userId, {
        institute: null,
        role: 'STUDENT',
        roleSetPermanently: false,
        roleSetAt: null,
        associationStatus: 'NONE',
        approvedBy: null,
        approvedAt: null,
        profileSetupComplete: false
      });

      // Remove any pending association requests
      await AssociationRequest.deleteMany({ 
        studentId: userId,
        institute: req.admin.institution 
      });

      res.json({ 
        message: 'User removed from institution successfully' 
      });
    }

    // Update institution stats
    await Institution.updateStats(req.admin.institution);

  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({
      message: 'Failed to remove user',
      error: error.message
    });
  }
});

// Bulk User Operations
router.post('/users/bulk-action', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { action, userIds, data } = req.body;

    if (!action || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        message: 'Action and userIds array are required'
      });
    }

    if (!['update-role', 'remove', 'activate', 'deactivate'].includes(action)) {
      return res.status(400).json({
        message: 'Invalid action. Supported actions: update-role, remove, activate, deactivate'
      });
    }

    // Verify all users belong to this institution
    const users = await User.find({
      _id: { $in: userIds },
      institute: req.admin.institution
    });

    if (users.length !== userIds.length) {
      return res.status(400).json({
        message: 'Some users not found in your institution'
      });
    }

    let updateResult;
    let message;

    switch (action) {
      case 'update-role':
        if (!data?.newRole || !['STUDENT', 'VERIFIER'].includes(data.newRole)) {
          return res.status(400).json({
            message: 'Valid newRole is required for update-role action'
          });
        }

        updateResult = await User.updateMany(
          { 
            _id: { $in: userIds },
            institute: req.admin.institution,
            roleSetPermanently: false // Only update if not permanently set
          },
          {
            role: data.newRole,
            roleSetPermanently: true,
            roleSetAt: new Date(),
            approvedBy: req.admin._id,
            approvedAt: new Date()
          }
        );

        message = `Updated ${updateResult.modifiedCount} users to ${data.newRole} role`;
        break;

      case 'remove':
        updateResult = await User.updateMany(
          { 
            _id: { $in: userIds },
            institute: req.admin.institution
          },
          {
            institute: null,
            role: 'STUDENT',
            roleSetPermanently: false,
            roleSetAt: null,
            associationStatus: 'NONE',
            approvedBy: null,
            approvedAt: null,
            profileSetupComplete: false
          }
        );

        // Remove association requests
        await AssociationRequest.deleteMany({
          studentId: { $in: userIds },
          institute: req.admin.institution
        });

        message = `Removed ${updateResult.modifiedCount} users from institution`;
        break;

      default:
        return res.status(400).json({ message: 'Action not implemented' });
    }

    // Update institution stats
    await Institution.updateStats(req.admin.institution);

    res.json({
      message,
      affectedUsers: updateResult.modifiedCount,
      totalRequested: userIds.length
    });

  } catch (error) {
    console.error('Bulk user action error:', error);
    res.status(500).json({
      message: 'Failed to perform bulk action',
      error: error.message
    });
  }
});

// Import Users from CSV/Excel (Bulk Create)
router.post('/users/bulk-import', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { users } = req.body; // Array of user objects

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        message: 'Users array is required and cannot be empty'
      });
    }

    if (users.length > 100) {
      return res.status(400).json({
        message: 'Cannot import more than 100 users at once'
      });
    }

    // Get institution details for email
    const institution = await Institution.findOne({ slug: req.admin.institution });;
    const institutionName = institution ? institution.name : 'Your Institution';

    const results = {
      created: [],
      failed: [],
      duplicates: [],
      emailResults: {
        sent: 0,
        failed: 0
      }
    };

    for (const userData of users) {
      try {
        const { name, email, role, bio, githubUsername } = userData;

        // Validation - password is no longer required in input
        if (!name || !email || !role) {
          results.failed.push({
            email: email || 'unknown',
            error: 'Missing required fields (name, email, role)'
          });
          continue;
        }

        if (!['STUDENT', 'VERIFIER'].includes(role)) {
          results.failed.push({
            email,
            error: 'Invalid role. Must be STUDENT or VERIFIER'
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          results.duplicates.push({
            email,
            error: 'User with this email already exists'
          });
          continue;
        }

        // Generate password automatically
        const generatedPassword = generatePassword(12, {
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: false, // Exclude symbols for easier typing
          excludeSimilar: true
        });

        // Create user
        const newUser = new User({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash: generatedPassword,
          role,
          institute: req.admin.institution,
          bio: bio ? bio.trim() : undefined,
          githubUsername: githubUsername ? githubUsername.trim() : undefined,
          profileSetupComplete: true,
          roleSetPermanently: true,
          roleSetAt: new Date(),
          associationStatus: 'APPROVED',
          approvedBy: req.admin._id,
          approvedAt: new Date()
        });

        await newUser.save();
        
        results.created.push({
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          password: generatedPassword // Include generated password in response
        });

        // Send welcome email with credentials
        try {
          const emailSent = await sendWelcomeEmailWithCredentials(
            newUser.email,
            newUser.name,
            generatedPassword,
            institutionName
          );
          
          if (emailSent) {
            results.emailResults.sent++;
          } else {
            results.emailResults.failed++;
          }
        } catch (emailError) {
          console.error(`Failed to send welcome email to ${newUser.email}:`, emailError);
          results.emailResults.failed++;
        }

      } catch (error) {
        results.failed.push({
          email: userData.email || 'unknown',
          error: error.message
        });
      }
    }

    // Update institution stats
    if (results.created.length > 0) {
      await Institution.updateStats(req.admin.institution);
    }

    // Generate CSV with passwords for successful creations
    let csvContent = '';
    if (results.created.length > 0) {
      const csvHeaders = 'Name,Email,Role,Password\n';
      const csvRows = results.created.map(user => 
        `"${user.name}","${user.email}","${user.role}","${user.password}"`
      ).join('\n');
      csvContent = csvHeaders + csvRows;
    }

    res.json({
      message: `Bulk import completed. Created: ${results.created.length}, Failed: ${results.failed.length}, Duplicates: ${results.duplicates.length}. Emails sent: ${results.emailResults.sent}, Email failures: ${results.emailResults.failed}`,
      summary: {
        totalProcessed: users.length,
        created: results.created.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length,
        emailsSent: results.emailResults.sent,
        emailsFailed: results.emailResults.failed
      },
      results: {
        created: results.created.map(user => ({
          email: user.email,
          name: user.name,
          role: user.role
          // Password removed from results for security (available in CSV)
        })),
        failed: results.failed,
        duplicates: results.duplicates
      },
      csvData: csvContent // CSV with passwords for download
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      message: 'Failed to import users',
      error: error.message
    });
  }
});

// Export Users Data
router.get('/users/export', requireInstituteAdmin, requirePermission('viewAnalytics'), async (req, res) => {
  try {
    const { format = 'json', role } = req.query;

let query = { instituteSlug: req.admin.institution }; 

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('name email role bio githubUsername profileSetupComplete associationStatus createdAt approvedAt')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Name,Email,Role,Bio,GitHub Username,Profile Complete,Association Status,Created At,Approved At\n';
      const csvData = users.map(user => {
        return [
          user.name,
          user.email,
          user.role,
          user.bio || '',
          user.githubUsername || '',
          user.profileSetupComplete,
          user.associationStatus,
          user.createdAt?.toISOString() || '',
          user.approvedAt?.toISOString() || ''
        ].map(field => `"${field}"`).join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users-${req.admin.institution}-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvHeaders + csvData);
    } else {
      // JSON format
      res.json({
        institution: req.admin.institution,
        exportedAt: new Date().toISOString(),
        totalUsers: users.length,
        users: users.map(user => user.toJSON())
      });
    }

  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({
      message: 'Failed to export users',
      error: error.message
    });
  }
});

// Get Institute Analytics
router.get('/analytics', requireInstituteAdmin, requirePermission('viewAnalytics'), async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents, 
      totalVerifiers,
      pendingAssociations,
      recentUsers
    ] = await Promise.all([
      User.countDocuments({ institute: req.admin.institution }),
      User.countDocuments({ institute: req.admin.institution, role: 'STUDENT' }),
      User.countDocuments({ institute: req.admin.institution, role: 'VERIFIER' }),
      AssociationRequest.countDocuments({ 
        institute: req.admin.institution, 
        status: 'PENDING' 
      }),
      User.find({ institute: req.admin.institution })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email role createdAt associationStatus')
    ]);

    const userGrowth = await User.aggregate([
      { 
        $match: { 
          institute: req.admin.institution,
          createdAt: { 
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const roleDistribution = await User.aggregate([
      { $match: { institute: req.admin.institution } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overview: {
        totalUsers,
        totalStudents,
        totalVerifiers,
        pendingAssociations
      },
      recentUsers,
      userGrowth,
      roleDistribution
    });

  } catch (error) {
    console.error('Get institute analytics error:', error);
    res.status(500).json({
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Get Pending Association Requests
router.get('/association-requests', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'PENDING' } = req.query;
    
    let query = { institute: req.admin.institution };
    
    if (status !== 'ALL') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [requests, total] = await Promise.all([
      AssociationRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('studentId', 'name email profilePicture')
        .populate('approvedBy', 'name email'),
      AssociationRequest.countDocuments(query)
    ]);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get association requests error:', error);
    res.status(500).json({
      message: 'Failed to fetch association requests',
      error: error.message
    });
  }
});

// Approve/Reject Association Request (Admin Override)
router.put('/association-requests/:requestId/respond', requireInstituteAdmin, requirePermission('manageUsers'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, response } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        message: 'Action must be either "approve" or "reject"'
      });
    }

    const associationRequest = await AssociationRequest.findOne({
      _id: requestId,
      institute: req.admin.institution,
      status: 'PENDING'
    });

    if (!associationRequest) {
      return res.status(404).json({
        message: 'Association request not found or already processed'
      });
    }

    const student = await User.findById(associationRequest.studentId);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const now = new Date();
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update association request
    await AssociationRequest.findByIdAndUpdate(requestId, {
      status: newStatus,
      verifierResponse: response ? response.trim() : `${action}d by institute admin`,
      respondedAt: now,
      approvedBy: req.admin._id,
      verifierId: req.admin._id,
      verifierEmail: req.admin.email,
      verifierName: req.admin.name
    });

    if (action === 'approve') {
      // Update student's profile with approved association
      await User.findByIdAndUpdate(student._id, {
        role: associationRequest.requestedRole,
        institute: associationRequest.institute,
        associationStatus: 'APPROVED',
        roleSetPermanently: true,
        roleSetAt: now,
        approvedBy: req.admin._id,
        approvedAt: now,
        profileSetupComplete: true
      });

      // Update institution stats
      await Institution.updateStats(req.admin.institution);

      res.json({
        message: `Association request approved successfully`,
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
        message: `Association request rejected`,
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

module.exports = router;
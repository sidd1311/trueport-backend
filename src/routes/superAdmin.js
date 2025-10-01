const express = require('express');
const SuperAdmin = require('../models/SuperAdmin');
const InstituteAdmin = require('../models/InstituteAdmin');
const Institution = require('../models/Institution');
const User = require('../models/User');
const { generateAdminToken, requireSuperAdmin } = require('../middlewares/adminAuth');

const router = express.Router();

// Super Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const admin = await SuperAdmin.findOne({ email: email.toLowerCase() });
    
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
      adminType: 'SUPER_ADMIN'
    });

    res.json({
      message: 'Login successful',
      token,
      admin: admin.toJSON()
    });

  } catch (error) {
    console.error('Super admin login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: error.message
    });
  }
});

// Get Super Admin Profile
router.get('/me', requireSuperAdmin, (req, res) => {
  res.json({
    admin: req.admin.toJSON()
  });
});

// Update Super Admin Profile
router.put('/me', requireSuperAdmin, async (req, res) => {
  try {
    const updates = {};
    const allowedUpdates = ['name', 'profilePicture'];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    updates.updatedAt = new Date();

    const admin = await SuperAdmin.findByIdAndUpdate(
      req.admin._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      admin: admin.toJSON()
    });

  } catch (error) {
    console.error('Update super admin profile error:', error);
    res.status(500).json({
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Change Super Admin Password
router.put('/change-password', requireSuperAdmin, async (req, res) => {
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
    console.error('Change super admin password error:', error);
    res.status(500).json({
      message: 'Failed to change password',
      error: error.message
    });
  }
});

// Create Institution
router.post('/institutions', requireSuperAdmin, async (req, res) => { 
  try {
    const {
      name,
      displayName,
      description,
      website,
      logo,
      address,
      contactInfo,
      settings
    } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        message: 'Institution name and display name are required'
      });
    }

    // Check if institution already exists
    const existingInstitution = await Institution.findOne({ 
      name: name.trim() 
    });
    
    if (existingInstitution) {
      return res.status(400).json({
        message: 'Institution with this name already exists'
      });
    }

    const institution = new Institution({
      name: name.trim(),
      displayName: displayName.trim(),
      description,
      website,
      logo,
      address,
      contactInfo,
      settings: {
        allowSelfRegistration: settings?.allowSelfRegistration ?? true,
        requireVerifierApproval: settings?.requireVerifierApproval ?? true,
        maxUsersLimit: settings?.maxUsersLimit ?? 1000
      },
      createdBy: req.admin._id
    });

    await institution.save();

    res.status(201).json({
      message: 'Institution created successfully',
      institution: institution.toJSON()
    });

  } catch (error) {
    console.error('Create institution error:', error);
    res.status(500).json({
      message: 'Failed to create institution',
      error: error.message
    });
  }
});

// Get All Institutions
router.get('/institutions', requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { displayName: new RegExp(search, 'i') },
        { 'contactInfo.email': new RegExp(search, 'i') }
      ];
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [institutions, total] = await Promise.all([
      Institution.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email'),
      Institution.countDocuments(query)
    ]);

    res.json({
      institutions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get institutions error:', error);
    res.status(500).json({
      message: 'Failed to fetch institutions',
      error: error.message
    });
  }
});

// Update Institution
router.put('/institutions/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.stats;

    updates.updatedAt = new Date();

    const institution = await Institution.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    res.json({
      message: 'Institution updated successfully',
      institution
    });

  } catch (error) {
    console.error('Update institution error:', error);
    res.status(500).json({
      message: 'Failed to update institution',
      error: error.message
    });
  }
});

// Delete Institution
router.delete('/institutions/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const institution = await Institution.findById(id);
    
    if (!institution) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    // Check if institution has users
    const userCount = await User.countDocuments({ institute: institution.name });
    
    if (userCount > 0) {
      return res.status(400).json({
        message: `Cannot delete institution with ${userCount} active users. Please transfer or remove users first.`
      });
    }

    // Check if institution has admins
    const adminCount = await InstituteAdmin.countDocuments({ institution: institution.name });
    
    if (adminCount > 0) {
      return res.status(400).json({
        message: `Cannot delete institution with ${adminCount} active admins. Please remove admins first.`
      });
    }

    await Institution.findByIdAndDelete(id);

    res.json({ message: 'Institution deleted successfully' });

  } catch (error) {
    console.error('Delete institution error:', error);
    res.status(500).json({
      message: 'Failed to delete institution',
      error: error.message
    });
  }
});

// Create Institute Admin
router.post('/institute-admins', requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, password, institution, permissions } = req.body;

    if (!name || !email || !phone || !password || !institution) {
      return res.status(400).json({
        message: 'Name, email, phone, password, and institution are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if institution exists
    const institutionDoc = await Institution.findOne({ name: institution });
    
    if (!institutionDoc) {
      return res.status(404).json({ message: 'Institution not found' });
    }

    // Check if admin with this email already exists
    const existingAdmin = await InstituteAdmin.findOne({ email: email.toLowerCase() });
    
    if (existingAdmin) {
      return res.status(400).json({
        message: 'Admin with this email already exists'
      });
    }

    const admin = new InstituteAdmin({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      passwordHash: password,
      institution: institution,
      permissions: {
        manageUsers: permissions?.manageUsers ?? true,
        manageVerifiers: permissions?.manageVerifiers ?? true,
        viewAnalytics: permissions?.viewAnalytics ?? true,
        manageSettings: permissions?.manageSettings ?? false
      },
      createdBy: req.admin._id
    });

    await admin.save();

    res.status(201).json({
      message: 'Institute admin created successfully',
      admin: admin.toJSON()
    });

  } catch (error) {
    console.error('Create institute admin error:', error);
    res.status(500).json({
      message: 'Failed to create institute admin',
      error: error.message
    });
  }
});

// Get All Institute Admins
router.get('/institute-admins', requireSuperAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, institution, isActive } = req.query;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { institution: new RegExp(search, 'i') }
      ];
    }

    if (institution) {
      query.institution = institution;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [admins, total] = await Promise.all([
      InstituteAdmin.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email'),
      InstituteAdmin.countDocuments(query)
    ]);

    res.json({
      admins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get institute admins error:', error);
    res.status(500).json({
      message: 'Failed to fetch institute admins',
      error: error.message
    });
  }
});

// Update Institute Admin
router.put('/institute-admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.createdBy;
    delete updates.createdAt;
    delete updates.passwordHash; // Use separate route for password changes

    updates.updatedAt = new Date();

    const admin = await InstituteAdmin.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!admin) {
      return res.status(404).json({ message: 'Institute admin not found' });
    }

    res.json({
      message: 'Institute admin updated successfully',
      admin: admin.toJSON()
    });

  } catch (error) {
    console.error('Update institute admin error:', error);
    res.status(500).json({
      message: 'Failed to update institute admin',
      error: error.message
    });
  }
});

// Delete Institute Admin
router.delete('/institute-admins/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await InstituteAdmin.findByIdAndDelete(id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Institute admin not found' });
    }

    res.json({ message: 'Institute admin deleted successfully' });

  } catch (error) {
    console.error('Delete institute admin error:', error);
    res.status(500).json({
      message: 'Failed to delete institute admin',
      error: error.message
    });
  }
});

// Get System Analytics
router.get('/analytics', requireSuperAdmin, async (req, res) => {
  try {
    const [
      totalInstitutions,
      totalInstituteAdmins,
      totalUsers,
      totalStudents,
      totalVerifiers,
      activeInstitutions,
      recentInstitutions
    ] = await Promise.all([
      Institution.countDocuments(),
      InstituteAdmin.countDocuments({ isActive: true }),
      User.countDocuments(),
      User.countDocuments({ role: 'STUDENT' }),
      User.countDocuments({ role: 'VERIFIER' }),
      Institution.countDocuments({ status: 'ACTIVE' }),
      Institution.find().sort({ createdAt: -1 }).limit(5).select('name displayName createdAt stats')
    ]);

    const usersByInstitute = await User.aggregate([
      {
        $group: {
          _id: '$institute',
          totalUsers: { $sum: 1 },
          students: { $sum: { $cond: [{ $eq: ['$role', 'STUDENT'] }, 1, 0] } },
          verifiers: { $sum: { $cond: [{ $eq: ['$role', 'VERIFIER'] }, 1, 0] } }
        }
      },
      { $sort: { totalUsers: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      overview: {
        totalInstitutions,
        totalInstituteAdmins,
        totalUsers,
        totalStudents,
        totalVerifiers,
        activeInstitutions
      },
      recentInstitutions,
      topInstitutions: usersByInstitute
    });

  } catch (error) {
    console.error('Get system analytics error:', error);
    res.status(500).json({
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

module.exports = router;
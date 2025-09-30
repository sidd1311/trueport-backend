const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const InstituteAdmin = require('../models/InstituteAdmin');

// Generate JWT token for admins
const generateAdminToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h' // Longer session for admins
  });
};

// Middleware to authenticate super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.adminType !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super admin privileges required.' });
    }

    const admin = await SuperAdmin.findById(decoded.adminId);
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid token or inactive admin account.' });
    }

    if (admin.isLocked) {
      return res.status(423).json({ message: 'Account is temporarily locked.' });
    }

    req.admin = admin;
    req.adminType = 'SUPER_ADMIN';
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    console.error('Super admin auth error:', error);
    res.status(500).json({ message: 'Authentication error.' });
  }
};

// Middleware to authenticate institute admin
const requireInstituteAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.adminType !== 'INSTITUTE_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Institute admin privileges required.' });
    }

    const admin = await InstituteAdmin.findById(decoded.adminId).populate('institution');
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid token or inactive admin account.' });
    }

    if (admin.isLocked) {
      return res.status(423).json({ message: 'Account is temporarily locked.' });
    }

    req.admin = admin;
    req.adminType = 'INSTITUTE_ADMIN';
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    console.error('Institute admin auth error:', error);
    res.status(500).json({ message: 'Authentication error.' });
  }
};

// Middleware to authenticate any admin (super or institute)
const requireAnyAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!['SUPER_ADMIN', 'INSTITUTE_ADMIN'].includes(decoded.adminType)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    let admin;
    if (decoded.adminType === 'SUPER_ADMIN') {
      admin = await SuperAdmin.findById(decoded.adminId);
    } else {
      admin = await InstituteAdmin.findById(decoded.adminId);
    }
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid token or inactive admin account.' });
    }

    if (admin.isLocked) {
      return res.status(423).json({ message: 'Account is temporarily locked.' });
    }

    req.admin = admin;
    req.adminType = decoded.adminType;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Authentication error.' });
  }
};

// Check specific permission for institute admin
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.adminType === 'SUPER_ADMIN') {
      // Super admins have all permissions
      return next();
    }

    if (req.adminType === 'INSTITUTE_ADMIN') {
      if (!req.admin.permissions[permission]) {
        return res.status(403).json({ 
          message: `Access denied. ${permission} permission required.` 
        });
      }
      return next();
    }

    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  };
};

module.exports = {
  generateAdminToken,
  requireSuperAdmin,
  requireInstituteAdmin,
  requireAnyAdmin,
  requirePermission
};
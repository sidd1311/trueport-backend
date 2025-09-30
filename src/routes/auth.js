const express = require('express');
const passport = require('../config/passport');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

const router = express.Router();

// Register - Simplified registration without role/institute
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Name, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email already exists' 
      });
    }

    // Create user with default role as STUDENT
    const user = new User({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save middleware
      role: 'STUDENT', // Default role
      profileSetupComplete: false // Flag to track if user completed profile setup
    });

    await user.save();

    // Generate JWT
    const token = generateToken({ 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'User with this email already exists' 
      });
    }
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: messages 
      });
    }

    res.status(500).json({ 
      message: 'Registration failed', 
      error: error.message 
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT
    const token = generateToken({ 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    });

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Login failed', 
      error: error.message 
    });
  }
});

// Google Auth routes
router.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google callback — set cookie AND optionally return JSON { token, user }
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      const user = req.user;
      if (!user) throw new Error('No user from passport');

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        email: user.email,
        role: user.role
      });

      // Set httpOnly cookie for cookie-based flow (keeps old behavior)
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      // Build sanitized user to send to client
      const safeUser = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        institute: user.institute || user.instituteId || null
      };

      // Detect if client expects JSON (SPA/fetch)
      const wantsJson =
        req.query.format === 'json' ||
        req.headers.accept?.includes('application/json') ||
        req.xhr ||
        req.headers['x-requested-with'] === 'XMLHttpRequest';

      if (wantsJson) {
        // Return same shape as regular /login
        return res.json({
          message: 'Login successful',
          success: true,
          token,
          user: safeUser
        });
      }

      // Otherwise default redirect flow: include token+user in fragment (not logged by servers)
      const frontend = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
      const payload = { token, user: safeUser };
      const fragment = `#auth=${encodeURIComponent(JSON.stringify(payload))}`;

      return res.redirect(`${frontend}/oauth-callback${fragment}`);
    } catch (error) {
      console.error('Google callback error:', error);
      const frontend = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
      return res.redirect(`${frontend}/auth/login?error=auth_failed`);
    }
  }
);

// Check auth status
router.get('/status', (req, res) => {
  if (req.user) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Token validation endpoint
router.post('/validate', async (req, res) => {
  console.log('=== /auth/validate called ===');
  console.log('Cookies parsed:', req.cookies);
  console.log('Cookie header:', req.headers.cookie);
  
  try {
    const { verifyToken } = require('../utils/jwt');
    
    let token = null;
    
    // 1. Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Token from Authorization header');
    }
    
    // 2. Check parsed cookies (if cookie-parser is working)
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
      console.log('Token from parsed cookie');
    }
    
    // 3. Manually parse cookie header (fallback if cookie-parser not configured)
    if (!token && req.headers.cookie) {
      console.log('Manually parsing cookie header');
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      
      if (cookies.auth_token) {
        token = cookies.auth_token;
        console.log('Token from manual cookie parse');
      }
    }
    
    if (!token) {
      console.log('No token found');
      return res.status(401).json({ 
        valid: false,
        message: 'No token provided' 
      });
    }

    console.log('Token found:', token.substring(0, 20) + '...');
    console.log('Verifying token...');
    
    const decoded = verifyToken(token);
    console.log('Token decoded:', decoded);
    
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ 
        valid: false,
        message: 'Invalid token - user not found' 
      });
    }

    console.log('User validated:', user.email);

    res.json({
      valid: true,
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Validation error:', error.message);
    
    res.status(401).json({ 
      valid: false, 
      message: error.message 
    });
  }
});
module.exports = router;
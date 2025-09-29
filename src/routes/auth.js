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

// Google callback route with CSP-compliant script
router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      const user = req.user;
      const nonce = crypto.randomBytes(16).toString('base64');
      
      // Generate JWT token
      const token = generateToken({ 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      });
      
      // Set CSP header with nonce
      res.setHeader(
        'Content-Security-Policy',
        `script-src 'self' 'nonce-${nonce}'; object-src 'none';`
      );
      
      // Close popup and send user data to parent window
      const target = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
res.send(`<!doctype html><html><body>
<script nonce="${nonce}">
  (function(){
    const payload = ${JSON.stringify({ type:'GOOGLE_AUTH_SUCCESS', token: '%%TOKEN%%', user: '%%USER%%' })}
      .replace('%%TOKEN%%', ${JSON.stringify(token)})
      .replace('%%USER%%', ${JSON.stringify(JSON.stringify(user.toJSON()))});
    try { window.opener && window.opener.postMessage(JSON.parse(payload), '${target}'); } catch(e){ console.error(e); }
    // close after parent ACK or after 3s fallback
    window.addEventListener('message', (e)=>{ if (e.data==='PARENT_ACK') setTimeout(()=>window.close(),200); });
    setTimeout(()=>window.close(),3000);
  })();
</script>
</body></html>`);

    } catch (error) {
      console.error('Google callback error:', error);
      const nonce = crypto.randomBytes(16).toString('base64');
      
      // Set CSP header with nonce for error case
      res.setHeader(
        'Content-Security-Policy',
        `script-src 'self' 'nonce-${nonce}'; object-src 'none';`
      );
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <meta charset="utf-8">
        </head>
        <body>
          <div style="text-align: center; font-family: Arial, sans-serif; padding: 50px;">
            <h3>Authentication failed</h3>
            <p>This window will close automatically...</p>
          </div>
          <script nonce="${nonce}">
            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'GOOGLE_AUTH_ERROR',
                  error: 'Authentication failed'
                }, 'http://localhost:3001');
              }
              setTimeout(() => {
                window.close();
              }, 2000);
            } catch (error) {
              console.error('Auth error callback error:', error);
              document.body.innerHTML = '<div style="text-align: center; font-family: Arial, sans-serif; padding: 50px;"><h3>Authentication failed!</h3><p>Please close this window.</p></div>';
            }
          </script>
          <noscript>
            <div style="text-align: center; font-family: Arial, sans-serif; padding: 50px;">
              <h3>Authentication failed!</h3>
              <p>Please close this window.</p>
            </div>
          </noscript>
        </body>
        </html>
      `);
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
  try {
    const { verifyToken } = require('../utils/jwt');
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid token - user not found' });
    }

    res.json({
      valid: true,
      user: user.toJSON()
    });

  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      message: error.message 
    });
  }
});

module.exports = router;
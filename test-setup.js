// Simple test to verify the backend setup without requiring MongoDB
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

console.log('🔍 Testing TruePortMe Backend Setup...\n');

// Test 1: Check if all dependencies are installed
console.log('✅ Testing dependencies...');
try {
  require('express');
  require('mongoose');
  require('bcrypt');
  require('jsonwebtoken');
  require('@sendgrid/mail');
  require('cloudinary');
  require('multer');
  require('cors');
  require('dotenv');
  require('express-rate-limit');
  require('helmet');
  require('axios');
  console.log('✅ All dependencies are installed correctly\n');
} catch (error) {
  console.log('❌ Missing dependency:', error.message);
  process.exit(1);
}

// Test 2: Check if environment variables can be loaded
console.log('✅ Testing environment configuration...');
require('dotenv').config();
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('⚠️  Missing environment variables:', missingVars.join(', '));
  console.log('   Please update your .env file with the required values\n');
} else {
  console.log('✅ Environment variables are configured\n');
}

// Test 3: Test Express app creation
console.log('✅ Testing Express app creation...');
try {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  
  app.get('/test', (req, res) => {
    res.json({ message: 'TruePortMe Backend is working!' });
  });

  const server = app.listen(3001, () => {
    console.log('✅ Express server created successfully');
    console.log('✅ Test server running on port 3001');
    console.log('\n🎉 TruePortMe Backend setup is complete!\n');
    
    console.log('📋 Next steps:');
    console.log('1. Update .env file with your MongoDB URI and other credentials');
    console.log('2. Start MongoDB service');
    console.log('3. Run: npm start (or npm run dev for development)');
    console.log('4. Test the API endpoints using the documentation in README.md\n');
    
    server.close();
    process.exit(0);
  });
} catch (error) {
  console.log('❌ Failed to create Express app:', error.message);
  process.exit(1);
}
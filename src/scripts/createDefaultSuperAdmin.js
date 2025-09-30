const mongoose = require('mongoose');
const SuperAdmin = require('../models/SuperAdmin');
require('dotenv').config();

const createDefaultSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trueportme';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check if super admin already exists
    const existingAdmin = await SuperAdmin.findOne({ email: 'admin@trueportme.com' });
    
    if (existingAdmin) {
      console.log('Default super admin already exists');
      console.log('Email: admin@trueportme.com');
      console.log('Please use the existing account or delete it first');
      process.exit(0);
    }

    // Create default super admin
    const defaultAdmin = new SuperAdmin({
      name: 'TruePortMe Admin',
      email: 'admin@trueportme.com',
      passwordHash: 'admin123456', // This will be hashed by the pre-save middleware
      permissions: {
        manageInstitutions: true,
        manageInstituteAdmins: true,
        viewSystemAnalytics: true,
        manageSystemSettings: true,
        accessAllData: true
      }
    });

    await defaultAdmin.save();

    console.log('✅ Default Super Admin created successfully!');
    console.log('📧 Email: admin@trueportme.com');
    console.log('🔑 Password: admin123456');
    console.log('⚠️  Please change the password after first login for security!');
    console.log('🌐 Login URL: http://localhost:3000/api/super-admin/login');

  } catch (error) {
    console.error('Error creating default super admin:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
createDefaultSuperAdmin();
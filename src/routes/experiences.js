const express = require('express');
const Experience = require('../models/Experience');
const { requireAuth } = require('../middlewares/auth');
const { upload } = require('../utils/cloudinary');

const router = express.Router();

// Create new experience
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, role, startDate, endDate, tags, attachments } = req.body;

    // Validation
    if (!title || !description || !role || !startDate) {
      return res.status(400).json({ 
        message: 'Title, description, role, and start date are required' 
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Invalid start date' });
    }
    
    if (end && (isNaN(end.getTime()) || end < start)) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const experience = new Experience({
      userId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      role: role.trim(),
      startDate: start,
      endDate: end,
      tags: tags ? tags.map(tag => tag.trim()).filter(tag => tag) : [],
      attachments: attachments || []
    });

    await experience.save();
    await experience.populate('userId', 'name email');

    res.status(201).json({
      message: 'Experience created successfully',
      experience
    });

  } catch (error) {
    console.error('Create experience error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: messages 
      });
    }

    res.status(500).json({ 
      message: 'Failed to create experience', 
      error: error.message 
    });
  }
});

// Get user's own experiences
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { userId: req.user._id };
    
    // Filter by verification status if specified
    if (req.query.verified !== undefined) {
      query.verified = req.query.verified === 'true';
    }

    // Filter by tags if specified
    if (req.query.tags) {
      const tags = req.query.tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tags };
    }

    const experiences = await Experience.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Experience.countDocuments(query);

    res.json({
      experiences,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get experiences error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch experiences', 
      error: error.message 
    });
  }
});

// Get specific experience (public access for verification)
router.get('/:id', async (req, res) => {
  try {
    const experience = await Experience.findById(req.params.id)
      .populate('userId', 'name email githubUsername');

    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    res.json({ experience });

  } catch (error) {
    console.error('Get experience error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid experience ID' });
    }

    res.status(500).json({ 
      message: 'Failed to fetch experience', 
      error: error.message 
    });
  }
});

// Update experience
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const experience = await Experience.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    // Don't allow updates to verified experiences
    if (experience.verified) {
      return res.status(400).json({ 
        message: 'Cannot update verified experience' 
      });
    }

    const updates = {};
    const allowedUpdates = ['title', 'description', 'role', 'startDate', 'endDate', 'tags', 'attachments'];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate dates if provided
    if (updates.startDate) {
      const start = new Date(updates.startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({ message: 'Invalid start date' });
      }
      updates.startDate = start;
    }

    if (updates.endDate) {
      const end = new Date(updates.endDate);
      const startDate = updates.startDate || experience.startDate;
      
      if (isNaN(end.getTime()) || end < startDate) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
      updates.endDate = end;
    }

    // Clean tags if provided
    if (updates.tags) {
      updates.tags = updates.tags.map(tag => tag.trim()).filter(tag => tag);
    }

    const updatedExperience = await Experience.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    res.json({
      message: 'Experience updated successfully',
      experience: updatedExperience
    });

  } catch (error) {
    console.error('Update experience error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: messages 
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid experience ID' });
    }

    res.status(500).json({ 
      message: 'Failed to update experience', 
      error: error.message 
    });
  }
});

// Delete experience
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const experience = await Experience.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!experience) {
      return res.status(404).json({ message: 'Experience not found' });
    }

    // Don't allow deletion of verified experiences
    if (experience.verified) {
      return res.status(400).json({ 
        message: 'Cannot delete verified experience' 
      });
    }

    await Experience.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Experience deleted successfully'
    });

  } catch (error) {
    console.error('Delete experience error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid experience ID' });
    }

    res.status(500).json({ 
      message: 'Failed to delete experience', 
      error: error.message 
    });
  }
});

// Upload file to Cloudinary
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.json({
      message: 'File uploaded successfully',
      url: req.file.path,
      publicId: req.file.filename
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ 
      message: 'File upload failed', 
      error: error.message 
    });
  }
});

module.exports = router;
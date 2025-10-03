const express = require('express');
const Project = require('../models/Project');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Create new project entry
router.post('/', requireAuth, async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      userId: req.user._id
    };

    // Basic validation
    if (!projectData.title || !projectData.description || !projectData.category) {
      return res.status(400).json({
        message: 'Title, description, and category are required'
      });
    }

    // Validate title length
    if (projectData.title.length > 200) {
      return res.status(400).json({
        message: 'Title must be less than 200 characters'
      });
    }

    // Validate description length
    if (projectData.description.length > 2000) {
      return res.status(400).json({
        message: 'Description must be less than 2000 characters'
      });
    }

    const project = new Project({
      userId: req.user._id,
      title: projectData.title.trim(),
      description: projectData.description.trim(),
      category: projectData.category,
      projectType: projectData.projectType || 'PERSONAL',
      skillsUsed: projectData.skillsUsed || [],
      keyFeatures: projectData.keyFeatures || [],
      learnings: projectData.learnings,
      challenges: projectData.challenges,
      outcome: projectData.outcome,
      links: {
        githubUrl: projectData.links?.githubUrl,
        liveUrl: projectData.links?.liveUrl,
        portfolioUrl: projectData.links?.portfolioUrl,
        documentUrl: projectData.links?.documentUrl,
        videoUrl: projectData.links?.videoUrl
      },
      duration: projectData.duration,
      teamSize: projectData.teamSize || 1,
      collaborators: projectData.collaborators || [],
      course: projectData.course,
      supervisor: projectData.supervisor,
      grade: projectData.grade,
      attachments: projectData.attachments
    });

    await project.save();
    await project.populate('userId', 'name email');

    res.status(201).json({
      message: 'Project created successfully',
      project
    });

  } catch (error) {
    console.error('Create project error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      message: 'Failed to create project',
      error: error.message
    });
  }
});

// Get user's own projects
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

    // Filter by project type if specified
    if (req.query.projectType) {
      query.projectType = req.query.projectType.toUpperCase();
    }

    // Filter by category if specified
    if (req.query.category) {
      query.category = req.query.category.toUpperCase();
    }

    // Filter by skills if specified
    if (req.query.skills) {
      const skills = req.query.skills.split(',').map(skill => skill.trim());
      query.skillsUsed = { $in: skills };
    }

    // Search by text if provided
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    const projects = await Project.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

// Get specific project (public access for verification)
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('userId', 'name email githubUsername');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if project is public or if user owns it
    if (!project.isPublic && (!req.user || project.userId._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'This project is private' });
    }

    // Increment view count if not owner
    if (!req.user || project.userId._id.toString() !== req.user._id.toString()) {
      await Project.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    }

    res.json({ project });

  } catch (error) {
    console.error('Get project error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    res.status(500).json({
      message: 'Failed to fetch GitHub project',
      error: error.message
    });
  }
});

// Update project
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or you do not have permission to edit it' });
    }

    // Don't allow updates to verified projects
    if (project.verified) {
      return res.status(400).json({
        message: 'Cannot update verified project'
      });
    }

    // Update project with new data
    Object.assign(project, req.body);
    await project.save();

    res.json({
      message: 'Project updated successfully',
      project
    });

  } catch (error) {
    console.error('Update project error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    res.status(500).json({
      message: 'Failed to update project',
      error: error.message
    });
  }
});

// Delete GitHub project
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found or you do not have permission to delete it' });
    }

    res.json({
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid project ID' });
    }

    res.status(500).json({
      message: 'Failed to delete project',
      error: error.message
    });
  }
});

module.exports = router;
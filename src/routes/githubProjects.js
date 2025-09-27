const express = require('express');
const GithubProject = require('../models/GithubProject');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Create new GitHub project entry
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      repositoryUrl,
      projectName,
      description,
      learnings,
      technologies,
      liveUrl,
      projectType
    } = req.body;

    // Validation
    if (!repositoryUrl || !projectName || !description || !learnings) {
      return res.status(400).json({
        message: 'Repository URL, project name, description, and learnings are required'
      });
    }

    // Validate GitHub URL
    const githubUrlPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
    if (!githubUrlPattern.test(repositoryUrl)) {
      return res.status(400).json({
        message: 'Repository URL must be a valid GitHub repository URL'
      });
    }

    const githubProject = new GithubProject({
      userId: req.user._id,
      repositoryUrl: repositoryUrl.trim(),
      projectName: projectName.trim(),
      description: description.trim(),
      learnings: learnings.trim(),
      technologies: technologies ? technologies.map(tech => tech.trim()).filter(tech => tech) : [],
      liveUrl: liveUrl ? liveUrl.trim() : undefined,
      projectType: projectType || 'PERSONAL'
    });

    await githubProject.save();
    await githubProject.populate('userId', 'name email');

    res.status(201).json({
      message: 'GitHub project created successfully',
      githubProject
    });

  } catch (error) {
    console.error('Create GitHub project error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      message: 'Failed to create GitHub project',
      error: error.message
    });
  }
});

// Get user's own GitHub projects
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

    // Filter by technologies if specified
    if (req.query.technologies) {
      const techs = req.query.technologies.split(',').map(tech => tech.trim());
      query.technologies = { $in: techs };
    }

    // Filter by live projects
    if (req.query.isLive !== undefined) {
      query.isLive = req.query.isLive === 'true';
    }

    const githubProjects = await GithubProject.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await GithubProject.countDocuments(query);

    res.json({
      githubProjects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get GitHub projects error:', error);
    res.status(500).json({
      message: 'Failed to fetch GitHub projects',
      error: error.message
    });
  }
});

// Get specific GitHub project (public access for verification)
router.get('/:id', async (req, res) => {
  try {
    const githubProject = await GithubProject.findById(req.params.id)
      .populate('userId', 'name email githubUsername');

    if (!githubProject) {
      return res.status(404).json({ message: 'GitHub project not found' });
    }

    res.json({ githubProject });

  } catch (error) {
    console.error('Get GitHub project error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid GitHub project ID' });
    }

    res.status(500).json({
      message: 'Failed to fetch GitHub project',
      error: error.message
    });
  }
});

// Update GitHub project
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const githubProject = await GithubProject.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!githubProject) {
      return res.status(404).json({ message: 'GitHub project not found' });
    }

    // Don't allow updates to verified projects
    if (githubProject.verified) {
      return res.status(400).json({
        message: 'Cannot update verified GitHub project'
      });
    }

    const updates = {};
    const allowedUpdates = [
      'repositoryUrl', 'projectName', 'description', 'learnings', 'technologies',
      'liveUrl', 'projectType'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate GitHub URL if provided
    if (updates.repositoryUrl) {
      const githubUrlPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+\/?$/;
      if (!githubUrlPattern.test(updates.repositoryUrl)) {
        return res.status(400).json({
          message: 'Repository URL must be a valid GitHub repository URL'
        });
      }
    }

    // Clean technologies if provided
    if (updates.technologies) {
      updates.technologies = updates.technologies.map(tech => tech.trim()).filter(tech => tech);
    }

    const updatedGithubProject = await GithubProject.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    res.json({
      message: 'GitHub project updated successfully',
      githubProject: updatedGithubProject
    });

  } catch (error) {
    console.error('Update GitHub project error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid GitHub project ID' });
    }

    res.status(500).json({
      message: 'Failed to update GitHub project',
      error: error.message
    });
  }
});

// Delete GitHub project
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const githubProject = await GithubProject.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!githubProject) {
      return res.status(404).json({ message: 'GitHub project not found' });
    }

    // Don't allow deletion of verified projects
    if (githubProject.verified) {
      return res.status(400).json({
        message: 'Cannot delete verified GitHub project'
      });
    }

    await GithubProject.findByIdAndDelete(req.params.id);

    res.json({
      message: 'GitHub project deleted successfully'
    });

  } catch (error) {
    console.error('Delete GitHub project error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid GitHub project ID' });
    }

    res.status(500).json({
      message: 'Failed to delete GitHub project',
      error: error.message
    });
  }
});

module.exports = router;
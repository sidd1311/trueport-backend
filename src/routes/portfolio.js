const express = require('express');
const User = require('../models/User');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const GithubProject = require('../models/GithubProject');
const axios = require('axios');

const router = express.Router();

// Get user's public portfolio
router.get('/:userId', async (req, res) => {
  try {
    // Get user info
    const user = await User.findById(req.params.userId)
      .select('name email githubUsername bio institute profileJson createdAt role');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get verified experiences
    const experiences = await Experience.find({
      userId: req.params.userId,
      verified: true
    }).sort({ verifiedAt: -1 });

    // Get verified education entries (latest first)
    const education = await Education.find({
      userId: req.params.userId,
      verified: true
    }).sort({ passingYear: -1, createdAt: -1 });

    // Get verified GitHub projects (latest first)
    const githubProjects = await GithubProject.find({
      userId: req.params.userId,
      verified: true
    }).sort({ createdAt: -1 });

    // Get GitHub repositories if GitHub username is available
    let githubRepos = [];
    if (user.githubUsername) {
      try {
        const response = await axios.get(
          `https://api.github.com/users/${user.githubUsername}/repos`,
          {
            params: {
              sort: 'updated',
              per_page: 10
            },
            timeout: 5000
          }
        );
        
        githubRepos = response.data.map(repo => ({
          id: repo.id,
          name: repo.name,
          description: repo.description,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          topics: repo.topics || []
        }));
      } catch (githubError) {
        console.warn(`Failed to fetch GitHub repos for ${user.githubUsername}:`, githubError.message);
        // Continue without GitHub data
      }
    }

    // Calculate portfolio stats
    const latestEducation = education.length > 0 ? education[0] : null;
    const latestGithubProject = githubProjects.length > 0 ? githubProjects[0] : null;
    
    const stats = {
      totalExperiences: experiences.length,
      totalEducation: education.length,
      totalGithubProjects: githubProjects.length,
      totalVerifications: experiences.length + education.length + githubProjects.length,
      githubRepos: githubRepos.length,
      lastUpdated: experiences.length > 0 ? experiences[0].verifiedAt : user.createdAt
    };

    res.json({
      user: user.toJSON(),
      experiences,
      education,
      githubProjects,
      githubRepos,
      latestEducation,
      latestGithubProject,
      stats
    });

  } catch (error) {
    console.error('Get portfolio error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    res.status(500).json({ 
      message: 'Failed to fetch portfolio', 
      error: error.message 
    });
  }
});

// Search portfolios
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      tags, 
      role, 
      institute,
      hasGithub,
      page = 1, 
      limit = 10 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build user query
    const userQuery = {};
    
    if (search) {
      userQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { githubUsername: { $regex: search, $options: 'i' } },
        { institute: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && role !== 'ALL') {
      userQuery.role = role;
    }

    if (institute) {
      userQuery.institute = { $regex: institute, $options: 'i' };
    }

    if (hasGithub === 'true') {
      userQuery.githubUsername = { $exists: true, $ne: '' };
    }

    // Find users with verified experiences
    const usersWithExperiences = await Experience.distinct('userId', { verified: true });
    userQuery._id = { $in: usersWithExperiences };

    const users = await User.find(userQuery)
      .select('name email githubUsername bio institute profileJson createdAt role')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(userQuery);

    // Get experience counts for each user
    const portfolios = await Promise.all(users.map(async (user) => {
      let experienceQuery = { userId: user._id, verified: true };
      
      // Filter by tags if specified
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        experienceQuery.tags = { $in: tagArray };
      }

      const experienceCount = await Experience.countDocuments(experienceQuery);
      const latestExperience = await Experience.findOne(experienceQuery)
        .sort({ verifiedAt: -1 })
        .select('title verifiedAt');

      return {
        user: user.toJSON(),
        experienceCount,
        latestExperience
      };
    }));

    // Filter out users with no matching experiences (if tag filter was applied)
    const filteredPortfolios = tags 
      ? portfolios.filter(p => p.experienceCount > 0)
      : portfolios;

    res.json({
      portfolios: filteredPortfolios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: tags ? filteredPortfolios.length : total,
        pages: Math.ceil((tags ? filteredPortfolios.length : total) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Search portfolios error:', error);
    res.status(500).json({ 
      message: 'Failed to search portfolios', 
      error: error.message 
    });
  }
});

// Get portfolio statistics
router.get('/:userId/stats', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const totalExperiences = await Experience.countDocuments({ userId: req.params.userId });
    const verifiedExperiences = await Experience.countDocuments({ 
      userId: req.params.userId, 
      verified: true 
    });
    
    const verificationRate = totalExperiences > 0 
      ? (verifiedExperiences / totalExperiences * 100).toFixed(1)
      : 0;

    // Get tag distribution
    const tagAggregation = await Experience.aggregate([
      { $match: { userId: user._id, verified: true } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topTags = tagAggregation.map(item => ({
      tag: item._id,
      count: item.count
    }));

    // Get monthly verification trend (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const monthlyTrend = await Experience.aggregate([
      { 
        $match: { 
          userId: user._id, 
          verified: true,
          verifiedAt: { $gte: oneYearAgo }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$verifiedAt' },
            month: { $month: '$verifiedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      totalExperiences,
      verifiedExperiences,
      verificationRate: parseFloat(verificationRate),
      topTags,
      monthlyTrend,
      joinedAt: user.createdAt
    });

  } catch (error) {
    console.error('Get portfolio stats error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    res.status(500).json({ 
      message: 'Failed to fetch portfolio statistics', 
      error: error.message 
    });
  }
});

module.exports = router;
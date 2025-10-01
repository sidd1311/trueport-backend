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
    // Get user info with portfolio settings
    const user = await User.findById(req.params.userId)
      .select('name email githubUsername bio institute profileJson createdAt role portfolioSettings contactInfo contactVisibility');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get portfolio settings with defaults
    const settings = user.portfolioSettings || {
      visibility: 'PUBLIC',
      sections: {
        showExperiences: true,
        showEducation: true,
        showProjects: true,
        showGithubRepos: true,
        showBio: true,
        showInstitute: true
      }
    };

    // Get contact visibility settings with defaults
    const contactVisibility = user.contactVisibility || {
      email: true,
      phone: false,
      linkedinUrl: true,
      githubUsername: true
    };

    // Check portfolio visibility
    if (settings.visibility === 'PRIVATE') {
      return res.status(403).json({ 
        message: 'This portfolio is private' 
      });
    }

    // For INSTITUTE_ONLY visibility, check if requester is from same institute
    // (This would need authentication context to fully implement)
    if (settings.visibility === 'INSTITUTE_ONLY') {
      // For now, allow access - in a full implementation, you'd check req.user.institute
      console.log('Institute-only portfolio accessed');
    }

    // Build response based on visibility settings
    const response = {
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        contactInfo: {}
      }
    };

    // Add optional user fields based on settings
    if (settings.sections.showBio && user.bio) {
      response.user.bio = user.bio;
    }

    if (settings.sections.showInstitute && user.institute) {
      response.user.institute = user.institute;
    }

    // Add contact information based on individual visibility settings
    let hasVisibleContactInfo = false;

    if (contactVisibility.email && user.email) {
      response.user.contactInfo.email = user.email;
      hasVisibleContactInfo = true;
    }

    if (contactVisibility.phone && user.contactInfo?.phone) {
      response.user.contactInfo.phone = user.contactInfo.phone;
      hasVisibleContactInfo = true;
    }

    if (contactVisibility.linkedinUrl && user.contactInfo?.linkedinUrl) {
      response.user.contactInfo.linkedinUrl = user.contactInfo.linkedinUrl;
      hasVisibleContactInfo = true;
    }

    if (contactVisibility.githubUsername && user.githubUsername) {
      response.user.contactInfo.githubUsername = user.githubUsername;
      hasVisibleContactInfo = true;
    }

    // Remove contactInfo object if no contact information is visible
    if (!hasVisibleContactInfo) {
      delete response.user.contactInfo;
    }

    // Get verified experiences (only public ones)
    let experiences = [];
    if (settings.sections.showExperiences) {
      experiences = await Experience.find({
        userId: req.params.userId,
        verified: true,
        isPublic: true
      }).sort({ verifiedAt: -1 });
    }

    // Get verified education entries (only public ones)
    let education = [];
    if (settings.sections.showEducation) {
      education = await Education.find({
        userId: req.params.userId,
        verified: true,
        isPublic: true
      }).sort({ passingYear: -1, createdAt: -1 });
    }

    // Get verified GitHub projects (only public ones)
    let githubProjects = [];
    if (settings.sections.showProjects) {
      githubProjects = await GithubProject.find({
        userId: req.params.userId,
        verified: true,
        isPublic: true
      }).sort({ createdAt: -1 });
    }

    // Get GitHub repositories if GitHub username is available, section is enabled, and GitHub username is visible
    let githubRepos = [];
    if (user.githubUsername && settings.sections.showGithubRepos && contactVisibility.githubUsername) {
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
      user: response.user, // Use the filtered user object that respects visibility settings
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
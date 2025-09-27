const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Get public GitHub repositories for a user
router.get('/public/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, per_page = 10, sort = 'updated' } = req.query;

    if (!username) {
      return res.status(400).json({ message: 'GitHub username is required' });
    }

    const response = await axios.get(
      `https://api.github.com/users/${username}/repos`,
      {
        params: {
          page: parseInt(page),
          per_page: Math.min(parseInt(per_page), 100), // GitHub API limit
          sort,
          type: 'owner'
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'TruePortMe-App',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          })
        }
      }
    );

    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      watchers_count: repo.watchers_count,
      forks_count: repo.forks_count,
      size: repo.size,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      topics: repo.topics || [],
      license: repo.license?.name || null,
      default_branch: repo.default_branch,
      is_fork: repo.fork,
      archived: repo.archived,
      disabled: repo.disabled
    }));

    // Get user info as well
    let userInfo = null;
    try {
      const userResponse = await axios.get(
        `https://api.github.com/users/${username}`,
        {
          timeout: 5000,
          headers: {
            'User-Agent': 'TruePortMe-App',
            ...(process.env.GITHUB_TOKEN && {
              'Authorization': `token ${process.env.GITHUB_TOKEN}`
            })
          }
        }
      );

      userInfo = {
        login: userResponse.data.login,
        name: userResponse.data.name,
        avatar_url: userResponse.data.avatar_url,
        bio: userResponse.data.bio,
        company: userResponse.data.company,
        location: userResponse.data.location,
        email: userResponse.data.email,
        blog: userResponse.data.blog,
        twitter_username: userResponse.data.twitter_username,
        public_repos: userResponse.data.public_repos,
        followers: userResponse.data.followers,
        following: userResponse.data.following,
        created_at: userResponse.data.created_at,
        updated_at: userResponse.data.updated_at
      };
    } catch (userError) {
      console.warn(`Failed to fetch GitHub user info for ${username}:`, userError.message);
    }

    res.json({
      user: userInfo,
      repos,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: userInfo?.public_repos || repos.length
      }
    });

  } catch (error) {
    console.error('GitHub API error:', error);

    if (error.response?.status === 404) {
      return res.status(404).json({ 
        message: 'GitHub user not found' 
      });
    }

    if (error.response?.status === 403) {
      return res.status(429).json({ 
        message: 'GitHub API rate limit exceeded. Please try again later.' 
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ 
        message: 'Request timeout. GitHub API is not responding.' 
      });
    }

    res.status(500).json({ 
      message: 'Failed to fetch GitHub repositories', 
      error: error.message 
    });
  }
});

// Get repository details
router.get('/repo/:username/:repo', async (req, res) => {
  try {
    const { username, repo } = req.params;

    const response = await axios.get(
      `https://api.github.com/repos/${username}/${repo}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'TruePortMe-App',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          })
        }
      }
    );

    // Also get README if available
    let readme = null;
    try {
      const readmeResponse = await axios.get(
        `https://api.github.com/repos/${username}/${repo}/readme`,
        {
          timeout: 5000,
          headers: {
            'User-Agent': 'TruePortMe-App',
            'Accept': 'application/vnd.github.v3.raw',
            ...(process.env.GITHUB_TOKEN && {
              'Authorization': `token ${process.env.GITHUB_TOKEN}`
            })
          }
        }
      );
      readme = readmeResponse.data;
    } catch (readmeError) {
      console.log(`No README found for ${username}/${repo}`);
    }

    // Get languages
    let languages = {};
    try {
      const languagesResponse = await axios.get(
        `https://api.github.com/repos/${username}/${repo}/languages`,
        {
          timeout: 5000,
          headers: {
            'User-Agent': 'TruePortMe-App',
            ...(process.env.GITHUB_TOKEN && {
              'Authorization': `token ${process.env.GITHUB_TOKEN}`
            })
          }
        }
      );
      languages = languagesResponse.data;
    } catch (languagesError) {
      console.log(`Failed to fetch languages for ${username}/${repo}`);
    }

    const repoData = {
      id: response.data.id,
      name: response.data.name,
      full_name: response.data.full_name,
      description: response.data.description,
      html_url: response.data.html_url,
      clone_url: response.data.clone_url,
      language: response.data.language,
      languages,
      stargazers_count: response.data.stargazers_count,
      watchers_count: response.data.watchers_count,
      forks_count: response.data.forks_count,
      size: response.data.size,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
      pushed_at: response.data.pushed_at,
      topics: response.data.topics || [],
      license: response.data.license?.name || null,
      default_branch: response.data.default_branch,
      is_private: response.data.private,
      is_fork: response.data.fork,
      archived: response.data.archived,
      disabled: response.data.disabled,
      readme
    };

    res.json({ repository: repoData });

  } catch (error) {
    console.error('GitHub repo API error:', error);

    if (error.response?.status === 404) {
      return res.status(404).json({ 
        message: 'Repository not found' 
      });
    }

    if (error.response?.status === 403) {
      return res.status(429).json({ 
        message: 'GitHub API rate limit exceeded. Please try again later.' 
      });
    }

    res.status(500).json({ 
      message: 'Failed to fetch repository details', 
      error: error.message 
    });
  }
});

// Search GitHub repositories
router.get('/search', async (req, res) => {
  try {
    const { q, sort = 'stars', order = 'desc', page = 1, per_page = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const response = await axios.get(
      'https://api.github.com/search/repositories',
      {
        params: {
          q,
          sort,
          order,
          page: parseInt(page),
          per_page: Math.min(parseInt(per_page), 100)
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'TruePortMe-App',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          })
        }
      }
    );

    const repos = response.data.items.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      topics: repo.topics || [],
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url
      }
    }));

    res.json({
      repositories: repos,
      total_count: response.data.total_count,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: response.data.total_count
      }
    });

  } catch (error) {
    console.error('GitHub search API error:', error);

    if (error.response?.status === 422) {
      return res.status(400).json({ 
        message: 'Invalid search query' 
      });
    }

    if (error.response?.status === 403) {
      return res.status(429).json({ 
        message: 'GitHub API rate limit exceeded. Please try again later.' 
      });
    }

    res.status(500).json({ 
      message: 'Failed to search GitHub repositories', 
      error: error.message 
    });
  }
});

// Optional: GitHub OAuth endpoints (if implementing OAuth)
/*
router.get('/auth', (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email,public_repo&redirect_uri=${process.env.FRONTEND_URL}/auth/github/callback`;
  res.redirect(githubAuthUrl);
});

router.post('/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, {
      headers: { Accept: 'application/json' }
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` }
    });

    // Handle user creation/login logic here
    
    res.json({ user: userResponse.data });
  } catch (error) {
    res.status(500).json({ message: 'GitHub OAuth failed', error: error.message });
  }
});
*/

module.exports = router;
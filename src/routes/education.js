const express = require('express');
const Education = require('../models/Education');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Create new education entry
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      courseType,
      courseName,
      boardOrUniversity,
      schoolOrCollege,
      passingYear,
      isExpected,
      grade,
      percentage,
      cgpa,
      description,
      attachments
    } = req.body;

    // Validation
    if (!courseType || !courseName || !boardOrUniversity || !schoolOrCollege || !passingYear) {
      return res.status(400).json({
        message: 'Course type, course name, board/university, school/college, and passing year are required'
      });
    }

    // Validate passing year
    const currentYear = new Date().getFullYear();
    if (passingYear < 1990 || passingYear > currentYear + 10) {
      return res.status(400).json({
        message: 'Passing year must be between 1990 and ' + (currentYear + 10)
      });
    }

    const education = new Education({
      userId: req.user._id,
      courseType: courseType.toUpperCase(),
      courseName: courseName.trim(),
      boardOrUniversity: boardOrUniversity.trim(),
      schoolOrCollege: schoolOrCollege.trim(),
      passingYear: parseInt(passingYear),
      isExpected: isExpected || false,
      grade: grade ? grade.trim() : undefined,
      percentage: percentage ? parseFloat(percentage) : undefined,
      cgpa: cgpa ? parseFloat(cgpa) : undefined,
      description: description ? description.trim() : undefined,
      attachments: attachments || []
    });

    await education.save();
    await education.populate('userId', 'name email');

    res.status(201).json({
      message: 'Education entry created successfully',
      education
    });

  } catch (error) {
    console.error('Create education error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      message: 'Failed to create education entry',
      error: error.message
    });
  }
});

// Get user's own education entries
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

    // Filter by course type if specified
    if (req.query.courseType) {
      query.courseType = req.query.courseType.toUpperCase();
    }

    const educations = await Education.find(query)
      .populate('userId', 'name email')
      .sort({ passingYear: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Education.countDocuments(query);

    res.json({
      educations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get educations error:', error);
    res.status(500).json({
      message: 'Failed to fetch education entries',
      error: error.message
    });
  }
});

// Get specific education entry (public access for verification)
router.get('/:id', async (req, res) => {
  try {
    const education = await Education.findById(req.params.id)
      .populate('userId', 'name email githubUsername');

    if (!education) {
      return res.status(404).json({ message: 'Education entry not found' });
    }

    res.json({ education });

  } catch (error) {
    console.error('Get education error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid education ID' });
    }

    res.status(500).json({
      message: 'Failed to fetch education entry',
      error: error.message
    });
  }
});

// Update education entry
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const education = await Education.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!education) {
      return res.status(404).json({ message: 'Education entry not found' });
    }

    // Don't allow updates to verified education entries
    if (education.verified) {
      return res.status(400).json({
        message: 'Cannot update verified education entry'
      });
    }

    const updates = {};
    const allowedUpdates = [
      'courseType', 'courseName', 'boardOrUniversity', 'schoolOrCollege',
      'passingYear', 'isExpected', 'grade', 'percentage', 'cgpa',
      'description', 'attachments'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Validate passing year if provided
    if (updates.passingYear) {
      const currentYear = new Date().getFullYear();
      const year = parseInt(updates.passingYear);
      if (year < 1990 || year > currentYear + 10) {
        return res.status(400).json({
          message: 'Passing year must be between 1990 and ' + (currentYear + 10)
        });
      }
      updates.passingYear = year;
    }

    // Clean and validate other fields
    if (updates.courseType) {
      updates.courseType = updates.courseType.toUpperCase();
    }

    const updatedEducation = await Education.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'name email');

    res.json({
      message: 'Education entry updated successfully',
      education: updatedEducation
    });

  } catch (error) {
    console.error('Update education error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid education ID' });
    }

    res.status(500).json({
      message: 'Failed to update education entry',
      error: error.message
    });
  }
});

// Delete education entry
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const education = await Education.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!education) {
      return res.status(404).json({ message: 'Education entry not found' });
    }

    // Don't allow deletion of verified education entries
    if (education.verified) {
      return res.status(400).json({
        message: 'Cannot delete verified education entry'
      });
    }

    await Education.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Education entry deleted successfully'
    });

  } catch (error) {
    console.error('Delete education error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid education ID' });
    }

    res.status(500).json({
      message: 'Failed to delete education entry',
      error: error.message
    });
  }
});

module.exports = router;
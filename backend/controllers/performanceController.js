const Performance = require('../models/Performance');
const Notification = require('../models/Notification');

// @desc    Submit monthly KPI review (Admin/HR)
// @route   POST /api/performance/review
// @access  Private (Admin, HR)
const submitReview = async (req, res) => {
  try {
    const { employeeId, monthYear, kpiRating, feedback } = req.body;

    if (!employeeId || !monthYear || !kpiRating) {
      return res.status(400).json({ message: 'employeeId, monthYear, and kpiRating are required' });
    }

    if (kpiRating < 1 || kpiRating > 5) {
      return res.status(400).json({ message: 'KPI rating must be between 1 and 5' });
    }

    // Check for existing review
    const existing = await Performance.findOne({ employeeId, monthYear });
    if (existing) {
      // Update existing review
      existing.kpiRating = kpiRating;
      existing.feedback = feedback || existing.feedback;
      existing.reviewedBy = req.user._id;
      await existing.save();

      // Notify employee of updated review
      await Notification.create({
        userId: employeeId,
        type: 'performance_reviewed',
        title: 'Performance Review Updated',
        message: `Your performance review for ${monthYear} has been updated. KPI Rating: ${kpiRating}/5.`,
        link: '/employee/performance',
      });

      return res.json(existing);
    }

    const review = await Performance.create({
      employeeId,
      monthYear,
      kpiRating,
      feedback,
      reviewedBy: req.user._id,
    });

    // Notify employee of new review
    await Notification.create({
      userId: employeeId,
      type: 'performance_reviewed',
      title: 'Performance Review Submitted',
      message: `Your performance review for ${monthYear} has been submitted. KPI Rating: ${kpiRating}/5.`,
      link: '/employee/performance',
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get my performance reviews
// @route   GET /api/performance/my-reviews
// @access  Private
const getMyReviews = async (req, res) => {
  try {
    const reviews = await Performance.find({ employeeId: req.user._id })
      .populate('reviewedBy', 'name')
      .sort({ monthYear: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all performance reviews (Admin/HR)
// @route   GET /api/performance/all
// @access  Private (Admin, HR)
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Performance.find({})
      .populate('employeeId', 'name email department designation')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitReview,
  getMyReviews,
  getAllReviews,
};

const express = require('express');
const router = express.Router();
const {
  submitReview,
  getMyReviews,
  getAllReviews,
} = require('../controllers/performanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/review', protect, authorizeRoles('Admin', 'HR'), submitReview);
router.get('/my-reviews', protect, getMyReviews);
router.get('/all', protect, authorizeRoles('Admin', 'HR'), getAllReviews);

module.exports = router;

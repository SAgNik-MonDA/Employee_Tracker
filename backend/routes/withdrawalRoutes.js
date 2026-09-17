const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest,
  markAsPaid,
} = require('../controllers/withdrawalController');

// Employee routes
router.post('/', protect, submitRequest);
router.get('/my-requests', protect, getMyRequests);

// Admin/HR/Finance routes
router.get('/all', protect, authorize('Admin', 'HR', 'Finance'), getAllRequests);
router.put('/:id/review', protect, authorize('Admin', 'HR', 'Finance'), reviewRequest);
router.post('/:id/pay', protect, authorize('Admin', 'HR', 'Finance'), markAsPaid);

module.exports = router;

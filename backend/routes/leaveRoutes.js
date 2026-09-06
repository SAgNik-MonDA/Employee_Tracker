const express = require('express');
const router = express.Router();
const {
  applyLeave,
  getMyLeaves,
  getMyBalance,
  getAllBalances,
  getAllLeaveRequests,
  updateLeaveStatus,
} = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Employee / HR routes
router.post('/apply',      protect, applyLeave);
router.get('/my-leaves',   protect, getMyLeaves);
router.get('/my-balance',  protect, getMyBalance);

// Admin + HR view routes
router.get('/all-requests', protect, authorizeRoles('Admin', 'HR'), getAllLeaveRequests);
router.get('/all-balances', protect, authorizeRoles('Admin', 'HR'), getAllBalances);

// Admin ONLY — approve / reject
router.put('/status/:id', protect, authorizeRoles('Admin'), updateLeaveStatus);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getActiveLeaveYear,
  setActiveLeaveYear,
} = require('../controllers/leaveConfigController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/leave-year', protect, getActiveLeaveYear);
router.put('/leave-year', protect, authorizeRoles('Admin'), setActiveLeaveYear);

module.exports = router;

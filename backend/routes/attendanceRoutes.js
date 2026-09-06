const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getMyAttendance,
  getMyAttendanceEnriched,
  getAllAttendance,
  getAllAttendanceEnriched,
  getEmployeeAttendanceStats,
  getTodayStatus,
  requestEarlyCheckout,
  reviewEarlyCheckout,
  getPendingEarlyCheckouts,
  getAllEarlyCheckouts,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/check-in',              protect,                                              checkIn);
router.put('/check-out',              protect,                                              checkOut);
router.get('/my-history',             protect,                                              getMyAttendance);
router.get('/my-history-enriched',    protect,                                              getMyAttendanceEnriched);
router.get('/today',                  protect,                                              getTodayStatus);
router.get('/employee-stats',         protect, authorizeRoles('Admin', 'HR'),               getEmployeeAttendanceStats);
router.get('/all',                    protect, authorizeRoles('Admin', 'HR'),               getAllAttendance);
router.get('/all-enriched',           protect, authorizeRoles('Admin', 'HR', 'Project Manager', 'Project Lead', 'General Manager', 'CEO', 'CTO', 'COO'), getAllAttendanceEnriched);

// Early Check-out routes
router.post('/early-checkout',        protect,                                              requestEarlyCheckout);
router.put('/early-checkout/:id',     protect, authorizeRoles('Admin', 'HR', 'Project Manager', 'Project Lead', 'Team Lead', 'Manager'), reviewEarlyCheckout);
router.get('/early-checkout/pending', protect, authorizeRoles('Admin', 'HR', 'Project Manager', 'Project Lead', 'Team Lead', 'Manager'), getPendingEarlyCheckouts);
router.get('/early-checkout/all',     protect, authorizeRoles('Admin', 'HR', 'Project Manager', 'Project Lead', 'Team Lead', 'Manager'), getAllEarlyCheckouts);

module.exports = router;


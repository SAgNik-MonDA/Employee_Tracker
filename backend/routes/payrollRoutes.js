const express = require('express');
const router = express.Router();
const {
  generatePayroll,
  getMyPayslips,
  getAllPayroll,
  markAsPaid,
} = require('../controllers/payrollController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/generate', protect, authorizeRoles('Admin'), generatePayroll);        // Admin only
router.get('/my-slips', protect, getMyPayslips);
router.get('/all', protect, authorizeRoles('Admin', 'HR'), getAllPayroll);          // Both can view
router.put('/mark-paid/:id', protect, authorizeRoles('Admin'), markAsPaid);        // Admin only

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  generatePayroll,
  generateSinglePayroll,
  getMyPayslips,
  getAllPayroll,
  markAsPaid,
  generateBonus,
  triggerAutoPayroll,
} = require('../controllers/payrollController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/generate', protect, authorizeRoles('Admin'), generatePayroll);                // Admin bulk or single (if employeeId in body)
router.post('/generate-single', protect, authorizeRoles('Admin'), generateSinglePayroll);   // Admin single employee
router.post('/trigger-auto-job', protect, authorizeRoles('Admin'), triggerAutoPayroll);     // Admin manual trigger for auto-scheduler
router.post('/generate-bonus', protect, authorizeRoles('Admin', 'HR'), generateBonus);         // Admin/HR can generate bonus
router.get('/my-slips', protect, getMyPayslips);
router.get('/all', protect, authorizeRoles('Admin', 'HR'), getAllPayroll);                  // Both can view
router.put('/mark-paid/:id', protect, authorizeRoles('Admin'), markAsPaid);                // Admin only

module.exports = router;

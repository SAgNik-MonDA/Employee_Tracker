const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest,
  markAsPaid,
  downloadSettlementPayslip,
} = require('../controllers/withdrawalController');

// Employee routes
router.post('/', protect, submitRequest);
router.get('/my-requests', protect, getMyRequests);
router.get('/:id/payslip', protect, downloadSettlementPayslip);

// Admin/HR/Finance routes
router.get('/all', protect, authorize('Admin', 'HR', 'Finance', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)'), getAllRequests);
router.put('/:id/review', protect, authorize('Admin', 'HR', 'Finance', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)'), reviewRequest);
router.post('/:id/pay', protect, authorize('Admin', 'HR', 'Finance', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)'), markAsPaid);

module.exports = router;

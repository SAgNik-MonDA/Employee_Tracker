const express = require('express');
const router = express.Router();
const {
  assignShift,
  lockShifts,
  unlockShifts,
  getShifts,
  getAllShifts,
  deleteShift,
  getShiftSummary
} = require('../controllers/shiftController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const ADMIN_AND_MANAGERS = ['Admin', 'HR', 'Project Manager', 'Project Lead', 'Team Lead', 'Manager'];

router.post('/assign', protect, authorizeRoles(...ADMIN_AND_MANAGERS), assignShift);
router.put('/lock', protect, authorizeRoles(...ADMIN_AND_MANAGERS), lockShifts);
router.put('/unlock', protect, authorizeRoles(...ADMIN_AND_MANAGERS), unlockShifts);
router.get('/summary', protect, authorizeRoles(...ADMIN_AND_MANAGERS), getShiftSummary);
router.get('/all', protect, authorizeRoles(...ADMIN_AND_MANAGERS), getAllShifts);
router.delete('/:id', protect, authorizeRoles(...ADMIN_AND_MANAGERS), deleteShift);
router.get('/:employeeId', protect, getShifts);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getAllStructures,
  upsertStructure,
  deleteStructure,
  lookupSalary,
} = require('../controllers/salaryStructureController');

const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

const AUTHORIZED_ROLES = [
  'Admin', 'HR',
  'Payroll Manager', 'Accounts Payable (AP) Specialist',
  'Chief Financial Officer (CFO)', 'CEO', 'CTO', 'COO',
];

router.get('/',         protect, authorizeRoles(...AUTHORIZED_ROLES), getAllStructures);
router.put('/',         protect, authorizeRoles(...AUTHORIZED_ROLES), upsertStructure);
router.delete('/:id',  protect, authorizeRoles('Admin'), deleteStructure);
router.get('/lookup',   protect, lookupSalary);

module.exports = router;

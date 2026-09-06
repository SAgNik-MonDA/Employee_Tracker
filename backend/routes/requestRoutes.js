const express = require('express');
const router = express.Router();
const {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest
} = require('../controllers/requestController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.post('/', protect, submitRequest);
router.get('/my-requests', protect, getMyRequests);
router.get('/all', protect, authorizeRoles('Admin', 'HR', 'Project Manager', 'Project Lead', 'Team Lead', 'Manager'), getAllRequests);
router.put('/:id/review', protect, authorizeRoles('Admin', 'HR', 'Project Manager', 'Project Lead', 'Team Lead', 'Manager'), reviewRequest);

module.exports = router;

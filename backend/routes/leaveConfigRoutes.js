const express = require('express');
const router = express.Router();
const {
  getConfigsByYear,
  upsertConfig,
} = require('../controllers/leaveConfigController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/', protect, authorizeRoles('Admin', 'HR'), getConfigsByYear);
router.put('/', protect, authorizeRoles('Admin', 'HR'), upsertConfig);

module.exports = router;

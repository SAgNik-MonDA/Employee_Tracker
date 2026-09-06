const express = require('express');
const router  = express.Router();
const { searchBanks, searchBranches, getIfscDetails } = require('../controllers/bankController');
const { protect } = require('../middleware/authMiddleware');

// All routes require login (no public access to bank data)

// GET /api/banks/search?q=sbi  → bank name autocomplete list
router.get('/search', protect, searchBanks);

// GET /api/banks/branches?bank=STATE BANK OF INDIA&branch=SALT LAKE
// → proxies Razorpay IFSC search (returns list of matching branches)
router.get('/branches', protect, searchBranches);

// GET /api/banks/ifsc/:code   → full details for a single IFSC code
router.get('/ifsc/:code', protect, getIfscDetails);

module.exports = router;

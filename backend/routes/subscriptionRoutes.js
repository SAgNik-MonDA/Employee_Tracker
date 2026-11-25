const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  verifyAndRegister,
  getMySubscriptionStatus,
  renewSubscription,
  getAllSubscriptions,
  getRevenueStats,
  exportSubscriptionsExcel,
  getGatewayConfig,
  updateGatewayConfig,
} = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// ── Public Routes (Landing Page & Onboarding) ───────────────────────────────
router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);
router.post('/verify-and-register', verifyAndRegister);

// ── Company Admin Routes (Lifecycle & Renewal) ──────────────────────────────
router.get('/my-status', protect, authorizeRoles('Admin'), getMySubscriptionStatus);
router.post('/renew', protect, authorizeRoles('Admin'), renewSubscription);

// ── SuperAdmin Exclusive Routes (Strict Data Boundaries) ───────────────────
router.get('/all', protect, authorizeRoles('SuperAdmin'), getAllSubscriptions);
router.get('/revenue-stats', protect, authorizeRoles('SuperAdmin'), getRevenueStats);
router.get('/export-excel', protect, authorizeRoles('SuperAdmin'), exportSubscriptionsExcel);
router.get('/gateway-config', protect, authorizeRoles('SuperAdmin'), getGatewayConfig);
router.put('/gateway-config', protect, authorizeRoles('SuperAdmin'), updateGatewayConfig);

module.exports = router;

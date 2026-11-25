const express = require('express');
const router = express.Router();
const {
  getPublicContent,
  trackVisitor,
  submitTestimonial,
  submitContactInquiry,
  updatePricingPlans,
  addClientLogo,
  deleteClientLogo,
  createFaq,
  updateFaq,
  deleteFaq,
  createRule,
  updateRule,
  deleteRule,
  getInquiries,
  replyToInquiry,
} = require('../controllers/landingController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// ── Public Landing Page Routes ───────────────────────────────────────────────
router.get('/public-content', getPublicContent);
router.post('/track-visitor', trackVisitor);
router.post('/submit-review', submitTestimonial);
router.post('/contact', submitContactInquiry);

// ── SuperAdmin CMS Management Routes ─────────────────────────────────────────
router.put('/pricing', protect, authorizeRoles('SuperAdmin'), updatePricingPlans);
router.post('/clients', protect, authorizeRoles('SuperAdmin'), addClientLogo);
router.delete('/clients/:id', protect, authorizeRoles('SuperAdmin'), deleteClientLogo);
router.post('/faqs', protect, authorizeRoles('SuperAdmin'), createFaq);
router.put('/faqs/:id', protect, authorizeRoles('SuperAdmin'), updateFaq);
router.delete('/faqs/:id', protect, authorizeRoles('SuperAdmin'), deleteFaq);
router.post('/rules', protect, authorizeRoles('SuperAdmin'), createRule);
router.put('/rules/:id', protect, authorizeRoles('SuperAdmin'), updateRule);
router.delete('/rules/:id', protect, authorizeRoles('SuperAdmin'), deleteRule);
router.get('/inquiries', protect, authorizeRoles('SuperAdmin'), getInquiries);
router.post('/inquiries/:id/reply', protect, authorizeRoles('SuperAdmin'), replyToInquiry);

module.exports = router;

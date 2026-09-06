const express = require('express');
const router  = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  getMyFullProfile,
  updateMyProfile,
  changePassword,
  checkCurrentPassword,
  checkBirthday,
  forgotPassword,
  resetPassword,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
  uploadAvatar,
  deleteAvatar,
  saveFaceDescriptor,
  requestFaceReset,
  reviewFaceReset,
  getFaceResetHistory,
} = require('../controllers/authController');

const { protect }         = require('../middleware/authMiddleware');
const { authorizeRoles }  = require('../middleware/roleMiddleware');
const upload              = require('../middleware/uploadMiddleware');

// ── Authentication & Admin Routes ────────────────────────────────────────────
router.post('/register',                 protect, authorizeRoles('Admin', 'HR'), registerUser);
router.post('/login',                    loginUser);
router.get('/employees',                 protect, authorizeRoles('Admin', 'HR', 'Manager', 'PM', 'TL'), getAllEmployees);
router.put('/employee/:id',              protect, authorizeRoles('Admin', 'HR'), updateEmployee);
router.delete('/employee/:id',           protect, authorizeRoles('Admin'), deleteEmployee);

// ── Password Reset ────────────────────────────────────────────────────────────
router.post('/forgot-password',          forgotPassword);
router.put('/reset-password/:token',     resetPassword);

// ── User Profile & Face Reset ─────────────────────────────────────────────────
router.get('/profile',                   protect, getUserProfile);
router.get('/my-profile',                protect, getMyFullProfile);
router.put('/my-profile',                protect, updateMyProfile);
router.post('/change-password',          protect, changePassword);
router.post('/check-current-password',   protect, checkCurrentPassword);
router.get('/birthday-check',            protect, checkBirthday);
router.post('/save-face',                protect, saveFaceDescriptor);
router.post('/request-face-reset',       protect, requestFaceReset);
router.put('/approve-face-reset/:id',    protect, authorizeRoles('Admin', 'HR'), reviewFaceReset);
router.get('/face-resets/history',       protect, authorizeRoles('Admin', 'HR'), getFaceResetHistory);


// ── Profile picture ──────────────────────────────────────────────────────────
router.post('/upload-avatar',            protect, upload.single('avatar'), uploadAvatar);
router.delete('/delete-avatar',          protect, deleteAvatar);

module.exports = router;

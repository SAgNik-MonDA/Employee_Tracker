const express = require('express');
const router  = express.Router();
const {
  createMeeting,
  getMeetings,
  submitMomAndAttendance,
  getUserMeetingStats,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  requestRejoin,
  handleRejoinRequest,
} = require('../controllers/meetingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/',                                protect, createMeeting);
router.get('/',                                 protect, getMeetings);
router.get('/my-stats',                         protect, getUserMeetingStats);
router.get('/stats/:userId',                    protect, getUserMeetingStats);
router.put('/:id/mom',                          protect, submitMomAndAttendance);
router.post('/:id/join',                        protect, joinMeeting);
router.post('/:id/rejoin-request',              protect, requestRejoin);
router.put('/:id/rejoin-request/:requestId',    protect, handleRejoinRequest);
router.put('/:id',                              protect, updateMeeting);
router.delete('/:id',                           protect, deleteMeeting);

module.exports = router;


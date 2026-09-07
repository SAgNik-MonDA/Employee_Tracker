const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const ctrl   = require('../controllers/teamController');

router.use(protect);

router.route('/')
  .get(ctrl.getTeams)
  .post(ctrl.createTeam);

router.get('/history/all', ctrl.getTeamHistory);
router.delete('/history/:id', ctrl.deleteTeamHistory);

router.route('/:id')
  .get(ctrl.getTeamById)
  .put(ctrl.updateTeam)
  .delete(ctrl.deleteTeam);

router.post('/:id/progress', ctrl.addProgressUpdate);
router.put('/:id/progress/:updateId/approve', ctrl.approveProgressUpdate);

router.post('/:id/documents', upload.single('file'), ctrl.addDocument);
router.delete('/:id/documents/:docId', ctrl.deleteDocument);

router.post('/:id/shifts', ctrl.scheduleShift);
router.delete('/:id/shifts/:shiftId', ctrl.deleteShift);

router.get('/:id/attendance', ctrl.getTeamAttendance);

router.route('/:id/chat')
  .get(ctrl.getChatMessages)
  .post(ctrl.sendChatMessage);

module.exports = router;

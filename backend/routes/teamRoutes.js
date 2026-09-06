const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const ctrl   = require('../controllers/teamController');

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'team-docs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

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

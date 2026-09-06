const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Permission keywords for creating meetings
const CREATOR_KEYWORDS = [
  'project manager', 'executive assistant', 'hr',
  'business analyst', 'account manager', 'admin',
  'program manager', 'delivery manager'
];

// Permission keywords for full company meeting visibility & automatic default invite
const PRIVILEGED_KEYWORDS = [
  'technical lead', 'team lead', 'project manager', 'program manager',
  'delivery manager', 'operations manager', 'business analyst',
  'account manager', 'executive assistant', 'hr', 'hr executive', 'hr manager',
  'director', 'director of technology', 'vice president', 'vp',
  'chief technology officer', 'cto', 'chief executive officer', 'ceo',
  'chief operating officer', 'coo', 'chief information officer', 'cio',
  'managing director', 'admin', 'ciso', 'cfo', 'cmo'
];

const canCreateMeeting = (user) => {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'HR') return true;
  const role = (user.role || '').toLowerCase();
  const desig = (user.designation || '').toLowerCase();
  return CREATOR_KEYWORDS.some(kw => role.includes(kw) || desig.includes(kw));
};

const isPrivilegedUser = (user) => {
  if (!user) return false;
  if (['Admin', 'HR', 'CEO', 'CTO', 'COO', 'CIO', 'CISO', 'Chief Financial Officer (CFO)'].includes(user.role)) return true;
  const role = (user.role || '').toLowerCase();
  const desig = (user.designation || '').toLowerCase();
  return PRIVILEGED_KEYWORDS.some(kw => role.includes(kw) || desig.includes(kw));
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new meeting
// @route   POST /api/meetings
// @access  Private (Authorized Creator Roles / Designations)
// ─────────────────────────────────────────────────────────────────────────────
const createMeeting = async (req, res) => {
  try {
    if (!canCreateMeeting(req.user)) {
      return res.status(403).json({
        message: 'Permission denied: Only Project Managers, Executive Assistants, HR, Business Analysts, Account Managers, or Admins can create meetings.'
      });
    }

    const { title, description, meetingLink, date, startTime, endTime, invitedEmployees, entryTimeLimitMinutes } = req.body;

    if (!title || !meetingLink || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Title, meeting link, date, start time, and end time are required' });
    }

    // Automatically include all users matching privileged designations/roles by default
    const allUsers = await User.find({}).select('_id role designation');
    const autoInviteIds = allUsers
      .filter((u) => isPrivilegedUser(u))
      .map((u) => u._id.toString());

    const manualIds = (invitedEmployees || []).map((id) => id.toString());

    // Merge manually invited employees + auto-invited management + creator
    const finalInvitedSet = new Set([
      ...manualIds,
      ...autoInviteIds,
      req.user._id.toString(),
    ]);

    const finalInvitedArray = Array.from(finalInvitedSet);

    // Attendance array strictly for manually called employees
    const attendanceList = manualIds.map((empId) => ({
      employeeId: empId,
      status: 'Pending',
    }));

    const meeting = await Meeting.create({
      title,
      description: description || '',
      meetingLink,
      date,
      startTime,
      endTime,
      entryTimeLimitMinutes: Number(entryTimeLimitMinutes) || 15,
      createdBy: req.user._id,
      invitedEmployees: finalInvitedArray,
      manualInvitedEmployees: manualIds,
      attendance: attendanceList,
    });


    const populated = await Meeting.findById(meeting._id)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('manualInvitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture');


    // Send notifications to ALL invited & auto-invited employees
    const dateFormatted = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const notifications = finalInvitedArray.map((empId) => ({
      userId: empId,
      type: 'meeting_invited',
      title: `📅 New Meeting Invitation: ${title}`,
      message: `${req.user.name} invited you to a meeting on ${dateFormatted} at ${startTime}.`,
      link: '/employee/meetings',
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications).catch(() => {});
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get meetings list (filtered by user access)
// @route   GET /api/meetings
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMeetings = async (req, res) => {
  try {
    let filter = {};

    // If not a privileged user, return only meetings where user is createdBy OR in invitedEmployees
    if (!isPrivilegedUser(req.user)) {
      filter = {
        $or: [
          { createdBy: req.user._id },
          { invitedEmployees: req.user._id },
        ],
      };
    }

    const meetings = await Meeting.find(filter)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('manualInvitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture')
      .sort({ date: -1, createdAt: -1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit MOM & Record Attendance
// @route   PUT /api/meetings/:id/mom
// @access  Private (Creator or Admin/HR)
// ─────────────────────────────────────────────────────────────────────────────
const submitMomAndAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { momText, attendance } = req.body; // attendance: [{ employeeId, status: 'Present'|'Absent' }]

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Permission: Creator or Admin/HR
    const isCreator = meeting.createdBy.toString() === req.user._id.toString();
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user.role);
    if (!isCreator && !isAdminOrHR) {
      return res.status(403).json({ message: 'Only the meeting creator or Admin/HR can submit MOM and attendance.' });
    }

    if (momText !== undefined) {
      meeting.momText = momText;
      meeting.isMomPublished = true;
      meeting.momSubmittedAt = new Date();
      meeting.status = 'Completed';
    }

    if (Array.isArray(attendance)) {
      meeting.attendance = attendance.map((item) => ({
        employeeId: item.employeeId,
        status: item.status === 'Present' ? 'Present' : 'Absent',
      }));
    }

    await meeting.save();

    const updated = await Meeting.findById(id)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('manualInvitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture');


    // Notify all invited employees with their attendance & MOM
    const notifications = (meeting.invitedEmployees || []).map((empId) => {
      const empAtt = (attendance || []).find((a) => a.employeeId.toString() === empId.toString());
      const statusStr = empAtt ? empAtt.status : 'Recorded';
      return {
        userId: empId,
        type: 'meeting_mom',
        title: `📝 MOM & Attendance Published: ${meeting.title}`,
        message: `Minutes of Meeting (MOM) published for "${meeting.title}". Your attendance status: ${statusStr}.`,
        link: '/employee/meetings',
      };
    });

    if (notifications.length > 0) {
      await Notification.insertMany(notifications).catch(() => {});
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get user meeting stats (Total invited, Present, Absent, Pending)
// @route   GET /api/meetings/stats/:userId
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getUserMeetingStats = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    // Find all meetings where employee is invited or in attendance list
    const meetings = await Meeting.find({
      $or: [
        { invitedEmployees: userId },
        { 'attendance.employeeId': userId },
      ],
    });

    let totalInvited = meetings.length;
    let totalPresent = 0;
    let totalAbsent  = 0;
    let totalPending = 0;

    meetings.forEach((m) => {
      const attItem = (m.attendance || []).find(
        (a) => a.employeeId && a.employeeId.toString() === userId.toString()
      );
      if (!attItem || attItem.status === 'Pending') {
        totalPending++;
      } else if (attItem.status === 'Present') {
        totalPresent++;
      } else if (attItem.status === 'Absent') {
        totalAbsent++;
      }
    });

    res.json({
      totalInvited,
      totalPresent,
      totalAbsent,
      totalPending,
      attendanceRate: (totalPresent + totalAbsent) > 0
        ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
        : 100,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Cancel / Update meeting details
// @route   PUT /api/meetings/:id
// @access  Private (Creator or Admin)
// ─────────────────────────────────────────────────────────────────────────────
const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const isCreator = meeting.createdBy.toString() === req.user._id.toString();
    if (!isCreator && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only creator or Admin can edit this meeting' });
    }

    Object.assign(meeting, req.body);
    await meeting.save();

    const updated = await Meeting.findById(id)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Join Meeting Video Call (Record Join + Instant Attendance for Mgmt)
// @route   POST /api/meetings/:id/join
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const joinMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const userIdStr = req.user._id.toString();

    // 1. If Management / Privileged user clicks Join: Instantly mark Attendance as 'Present'!
    if (isPrivilegedUser(req.user)) {
      const existingAttIndex = meeting.attendance.findIndex(
        (a) => a.employeeId.toString() === userIdStr
      );
      if (existingAttIndex >= 0) {
        meeting.attendance[existingAttIndex].status = 'Present';
      } else {
        meeting.attendance.push({ employeeId: req.user._id, status: 'Present' });
      }
    }

    // 2. Track Join in joinedUsers
    const alreadyJoined = meeting.joinedUsers.some(
      (j) => j.userId.toString() === userIdStr
    );

    if (!alreadyJoined) {
      meeting.joinedUsers.push({ userId: req.user._id, joinedAt: new Date() });
    }

    await meeting.save();

    const updated = await Meeting.findById(id)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('manualInvitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture')
      .populate('rejoinRequests.userId', 'name email designation department employeeCode profilePicture');

    res.json({ meetingLink: meeting.meetingLink, meeting: updated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Request Rejoin (when disconnected/left by mistake)
// @route   POST /api/meetings/:id/rejoin-request
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const requestRejoin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason for leaving is required' });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    // Push new rejoin request
    meeting.rejoinRequests.push({
      userId: req.user._id,
      reason: reason.trim(),
      status: 'Pending',
      requestedAt: new Date(),
    });

    await meeting.save();

    // Send notification to meeting creator
    await Notification.create({
      userId: meeting.createdBy,
      type: 'meeting_rejoin_request',
      title: `🔄 Rejoin Request: ${req.user.name}`,
      message: `${req.user.name} requested to rejoin meeting "${meeting.title}". Reason: ${reason}`,
      link: '/employee/meetings',
    }).catch(() => {});

    const updated = await Meeting.findById(id)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('manualInvitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture')
      .populate('rejoinRequests.userId', 'name email designation department employeeCode profilePicture');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Handle (Approve/Reject) Rejoin Request
// @route   PUT /api/meetings/:id/rejoin-request/:requestId
// @access  Private (Meeting Creator or Admin/HR)
// ─────────────────────────────────────────────────────────────────────────────
const handleRejoinRequest = async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const isCreator = meeting.createdBy.toString() === req.user._id.toString();
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user.role);
    if (!isCreator && !isAdminOrHR) {
      return res.status(403).json({ message: 'Only creator or Admin/HR can respond to rejoin requests' });
    }

    const reqItem = meeting.rejoinRequests.id(requestId);
    if (!reqItem) return res.status(404).json({ message: 'Rejoin request not found' });

    reqItem.status = action === 'approve' ? 'Approved' : 'Rejected';
    await meeting.save();

    // Notify requesting user
    await Notification.create({
      userId: reqItem.userId,
      type: 'meeting_rejoin_approved',
      title: action === 'approve' ? `✅ Rejoin Approved: ${meeting.title}` : `❌ Rejoin Request Declined: ${meeting.title}`,
      message: action === 'approve'
        ? `Your request to rejoin "${meeting.title}" was approved by ${req.user.name}. You can now join the call.`
        : `Your request to rejoin "${meeting.title}" was declined.`,
      link: '/employee/meetings',
    }).catch(() => {});

    const updated = await Meeting.findById(id)
      .populate('createdBy', 'name email designation role profilePicture')
      .populate('invitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('manualInvitedEmployees', 'name email designation department employeeCode profilePicture')
      .populate('attendance.employeeId', 'name email designation department employeeCode profilePicture')
      .populate('rejoinRequests.userId', 'name email designation department employeeCode profilePicture');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private (Creator or Admin)
// ─────────────────────────────────────────────────────────────────────────────
const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const isCreator = meeting.createdBy.toString() === req.user._id.toString();
    if (!isCreator && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only creator or Admin can delete this meeting' });
    }

    await Meeting.findByIdAndDelete(id);
    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


module.exports = {
  createMeeting,
  getMeetings,
  submitMomAndAttendance,
  getUserMeetingStats,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  requestRejoin,
  handleRejoinRequest,
};



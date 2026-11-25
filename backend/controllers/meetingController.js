const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getTenantId, getTenantUserFilter, belongsToTenant } = require('../utils/tenantHelper');

// Permission keywords for creating meetings
const CREATOR_KEYWORDS = [
  'project manager', 'executive assistant', 'hr',
  'business analyst', 'account manager', 'admin',
  'program manager', 'delivery manager',
];

// Permission keywords for full company meeting visibility & automatic default invite
const PRIVILEGED_KEYWORDS = [
  'technical lead', 'team lead', 'project manager', 'program manager',
  'delivery manager', 'operations manager', 'business analyst',
  'account manager', 'executive assistant', 'hr', 'hr executive', 'hr manager',
  'director', 'director of technology', 'vice president', 'vp',
  'chief technology officer', 'cto', 'chief executive officer', 'ceo',
  'chief operating officer', 'coo', 'chief information officer', 'cio',
  'managing director', 'admin', 'ciso', 'cfo', 'cmo',
];

const canCreateMeeting = (user) => {
  if (!user) return false;
  if (user.role === 'Admin' || user.role === 'HR') return true;
  const role = (user.role || '').toLowerCase();
  const desig = (user.designation || '').toLowerCase();
  return CREATOR_KEYWORDS.some((kw) => role.includes(kw) || desig.includes(kw));
};

const isPrivilegedUser = (user) => {
  if (!user) return false;
  if (['Admin', 'HR', 'CEO', 'CTO', 'COO', 'CIO', 'CISO', 'Chief Financial Officer (CFO)'].includes(user.role)) return true;
  const role = (user.role || '').toLowerCase();
  const desig = (user.designation || '').toLowerCase();
  return PRIVILEGED_KEYWORDS.some((kw) => role.includes(kw) || desig.includes(kw));
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new meeting (strictly scoped to caller's organization)
// @route   POST /api/meetings
// @access  Private (Authorized Creator Roles / Designations)
// ─────────────────────────────────────────────────────────────────────────────
const createMeeting = async (req, res) => {
  try {
    if (!canCreateMeeting(req.user)) {
      return res.status(403).json({
        message: 'Permission denied: Only Project Managers, Executive Assistants, HR, Business Analysts, Account Managers, or Admins can create meetings.',
      });
    }

    const tenantId = req.tenantId || getTenantId(req.user);
    const { title, description, meetingLink, date, startTime, endTime, invitedEmployees, entryTimeLimitMinutes } = req.body;

    if (!title || !meetingLink || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Title, meeting link, date, start time, and end time are required' });
    }

    // Fetch ONLY users belonging to THIS company tenant
    const companyUsers = await User.find(getTenantUserFilter(tenantId)).select('_id role designation');
    const validCompanyIds = new Set(companyUsers.map((u) => u._id.toString()));

    const autoInviteIds = companyUsers
      .filter((u) => isPrivilegedUser(u))
      .map((u) => u._id.toString());

    // Ensure manually invited employees belong strictly to this company
    const manualIds = (invitedEmployees || [])
      .map((id) => id.toString())
      .filter((id) => validCompanyIds.has(id));

    const finalInvitedSet = new Set([
      ...manualIds,
      ...autoInviteIds,
      req.user._id.toString(),
    ]);

    const finalInvitedArray = Array.from(finalInvitedSet);

    const attendanceList = manualIds.map((empId) => ({
      employeeId: empId,
      status: 'Pending',
    }));

    const meeting = await Meeting.create({
      companyId: tenantId,
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

    const dateFormatted = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const notifications = finalInvitedArray.map((empId) => ({
      companyId: tenantId,
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
// @desc    Get meetings list (strictly scoped to caller's organization)
// @route   GET /api/meetings
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMeetings = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    let filter = { companyId: tenantId };

    if (!isPrivilegedUser(req.user)) {
      filter = {
        companyId: tenantId,
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
// @desc    Submit MOM & Record Attendance (tenant-isolated)
// @route   PUT /api/meetings/:id/mom
// @access  Private (Creator or Admin/HR)
// ─────────────────────────────────────────────────────────────────────────────
const submitMomAndAttendance = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { id } = req.params;
    const { momText, attendance } = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting || !belongsToTenant(meeting, tenantId)) {
      return res.status(404).json({ message: 'Meeting not found in your organization' });
    }

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

    const notifications = (meeting.invitedEmployees || []).map((empId) => {
      const empAtt = (attendance || []).find((a) => a.employeeId.toString() === empId.toString());
      const statusStr = empAtt ? empAtt.status : 'Recorded';
      return {
        companyId: tenantId,
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
// @desc    Get user meeting stats (tenant-isolated)
// @route   GET /api/meetings/stats/:userId
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getUserMeetingStats = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const userId = req.params.userId || req.user._id;

    if (req.params.userId && req.params.userId !== req.user._id.toString()) {
      const targetEmp = await User.findById(req.params.userId).select('companyId _id');
      if (!targetEmp || !belongsToTenant(targetEmp, tenantId)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const meetings = await Meeting.find({
      companyId: tenantId,
      $or: [
        { invitedEmployees: userId },
        { 'attendance.employeeId': userId },
      ],
    });

    let totalInvited = meetings.length;
    let totalPresent = 0;
    let totalAbsent = 0;
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
// @desc    Cancel / Update meeting details (tenant-isolated)
// @route   PUT /api/meetings/:id
// @access  Private (Creator or Admin)
// ─────────────────────────────────────────────────────────────────────────────
const updateMeeting = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting || !belongsToTenant(meeting, tenantId)) {
      return res.status(404).json({ message: 'Meeting not found in your organization' });
    }

    const isCreator = meeting.createdBy.toString() === req.user._id.toString();
    if (!isCreator && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Only creator or Admin can edit this meeting' });
    }

    Object.assign(meeting, req.body);
    meeting.companyId = tenantId; // prevent tampering
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
// @desc    Join Meeting Video Call (tenant-isolated)
// @route   POST /api/meetings/:id/join
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const joinMeeting = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting || !belongsToTenant(meeting, tenantId)) {
      return res.status(404).json({ message: 'Meeting not found in your organization' });
    }

    const userIdStr = req.user._id.toString();

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
// @desc    Request Rejoin (tenant-isolated)
// @route   POST /api/meetings/:id/rejoin-request
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const requestRejoin = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason for leaving is required' });
    }

    const meeting = await Meeting.findById(id);
    if (!meeting || !belongsToTenant(meeting, tenantId)) {
      return res.status(404).json({ message: 'Meeting not found in your organization' });
    }

    meeting.rejoinRequests.push({
      userId: req.user._id,
      reason: reason.trim(),
      status: 'Pending',
      requestedAt: new Date(),
    });

    await meeting.save();

    await Notification.create({
      companyId: tenantId,
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
// @desc    Handle (Approve/Reject) Rejoin Request (tenant-isolated)
// @route   PUT /api/meetings/:id/rejoin-request/:requestId
// @access  Private (Meeting Creator or Admin/HR)
// ─────────────────────────────────────────────────────────────────────────────
const handleRejoinRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { id, requestId } = req.params;
    const { action } = req.body;

    const meeting = await Meeting.findById(id);
    if (!meeting || !belongsToTenant(meeting, tenantId)) {
      return res.status(404).json({ message: 'Meeting not found in your organization' });
    }

    const isCreator = meeting.createdBy.toString() === req.user._id.toString();
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user.role);
    if (!isCreator && !isAdminOrHR) {
      return res.status(403).json({ message: 'Only creator or Admin/HR can respond to rejoin requests' });
    }

    const reqItem = meeting.rejoinRequests.id(requestId);
    if (!reqItem) return res.status(404).json({ message: 'Rejoin request not found' });

    reqItem.status = action === 'approve' ? 'Approved' : 'Rejected';
    await meeting.save();

    await Notification.create({
      companyId: tenantId,
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
// @desc    Delete meeting (tenant-isolated)
// @route   DELETE /api/meetings/:id
// @access  Private (Creator or Admin)
// ─────────────────────────────────────────────────────────────────────────────
const deleteMeeting = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { id } = req.params;
    const meeting = await Meeting.findById(id);
    if (!meeting || !belongsToTenant(meeting, tenantId)) {
      return res.status(404).json({ message: 'Meeting not found in your organization' });
    }

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

const EmployeeRequest = require('../models/EmployeeRequest');
const ShiftSchedule = require('../models/ShiftSchedule');
const Team = require('../models/Team');
const Notification = require('../models/Notification');
const { getTenantId, belongsToTenant, getTenantAdmins } = require('../utils/tenantHelper');

// @desc    Submit a generic employee request (tenant-isolated)
// @route   POST /api/requests
// @access  Private
const submitRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { requestType, reason, dateRequestedFor, shiftDate, currentShift, desiredShift } = req.body;

    const targetDate = shiftDate || dateRequestedFor;

    if (!requestType || !reason || !targetDate) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (requestType === 'Shift Change' && (!desiredShift || !currentShift)) {
      return res.status(400).json({ message: 'Please select both current shift and desired shift.' });
    }

    const newRequest = await EmployeeRequest.create({
      companyId: tenantId,
      employeeId: req.user._id,
      requestType,
      reason,
      dateRequestedFor: targetDate,
      shiftDate: requestType === 'Shift Change' ? targetDate : null,
      currentShift: requestType === 'Shift Change' ? currentShift : '',
      desiredShift: requestType === 'Shift Change' ? desiredShift : '',
    });

    // Notify ONLY this company's Admin and HR users
    const admins = await getTenantAdmins(tenantId);
    const notifDocs = admins.map((admin) => ({
      companyId: tenantId,
      userId: admin._id,
      type: 'general_request_submitted',
      title: `New ${requestType} Request`,
      message: `${req.user.name} submitted a ${requestType} request.`,
      link: '/admin/requests',
    }));
    if (notifDocs.length > 0) await Notification.insertMany(notifDocs);

    res.status(201).json({ message: 'Request submitted successfully', request: newRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get my generic requests
// @route   GET /api/requests/my-requests
// @access  Private
const getMyRequests = async (req, res) => {
  try {
    const requests = await EmployeeRequest.find({ employeeId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all employee requests (Admin/HR/PM — tenant-isolated)
// @route   GET /api/requests/all
// @access  Private (Admin, HR, PM, etc.)
const getAllRequests = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const requests = await EmployeeRequest.find({ companyId: tenantId })
      .populate('employeeId', 'name profilePicture designation employeeCode')
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Review (Approve/Reject) a request (tenant-isolated)
// @route   PUT /api/requests/:id/review
// @access  Private (Admin, HR, PM, etc.)
const reviewRequest = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { status, reviewNotes } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const request = await EmployeeRequest.findById(req.params.id);
    if (!request || !belongsToTenant(request, tenantId)) {
      return res.status(404).json({ message: 'Request not found in your organization.' });
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    if (reviewNotes !== undefined) request.reviewNotes = reviewNotes;

    await request.save();

    if (status === 'Approved' && request.requestType === 'Shift Change' && request.desiredShift) {
      const sDate = request.shiftDate || request.dateRequestedFor;
      if (sDate) {
        const sDateObj = new Date(sDate);
        const dateStr = sDateObj.toISOString().split('T')[0];
        const start = new Date(dateStr + 'T00:00:00.000Z');
        const end = new Date(dateStr + 'T23:59:59.999Z');

        const existingGlobal = await ShiftSchedule.findOne({ employeeId: request.employeeId, date: { $gte: start, $lte: end } });
        if (existingGlobal) {
          existingGlobal.shiftType = request.desiredShift;
          existingGlobal.scheduledBy = req.user._id;
          await existingGlobal.save();
        } else {
          await ShiftSchedule.create({
            companyId: tenantId,
            employeeId: request.employeeId,
            shiftType: request.desiredShift,
            date: start,
            scheduledBy: req.user._id,
          });
        }

        const teams = await Team.find({ companyId: tenantId, members: request.employeeId });
        for (const t of teams) {
          let changed = false;
          for (const s of (t.shifts || [])) {
            const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
            const sDateStr = new Date(s.date).toISOString().split('T')[0];
            if (sEmp === request.employeeId.toString() && sDateStr === dateStr) {
              s.shiftType = request.desiredShift;
              changed = true;
            }
          }
          if (changed) await t.save();
        }
      }
    }

    await Notification.create({
      companyId: tenantId,
      userId: request.employeeId,
      type: 'general_request_reviewed',
      title: `Request ${status}`,
      message: `Your ${request.requestType} request has been ${status.toLowerCase()}.`,
      link: '/employee/requests',
    });

    res.json({ message: `Request has been ${status.toLowerCase()}` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitRequest,
  getMyRequests,
  getAllRequests,
  reviewRequest,
};

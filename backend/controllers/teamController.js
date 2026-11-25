const Team = require('../models/Team');
const TeamChat = require('../models/TeamChat');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ShiftSchedule = require('../models/ShiftSchedule');
const TeamHistory = require('../models/TeamHistory');
const Notification = require('../models/Notification');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const { getTenantId, getTenantUserFilter, belongsToTenant } = require('../utils/tenantHelper');

// Helper: extract Cloudinary public_id from a secure_url
const getCloudinaryPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const afterUpload = parts[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^.]+$/, '');
    return publicId;
  } catch {
    return null;
  }
};

const TEAM_CREATOR_DESIGNATIONS = [
  'technical lead', 'team lead', 'project manager', 'program manager',
  'operations manager', 'director of technology',
  'chief technology officer (cto)', 'cto',
];
const canManageTeam = (user) => {
  if (['Admin', 'HR'].includes(user.role)) return true;
  const des = (user.designation || user.role || '').toLowerCase();
  return TEAM_CREATOR_DESIGNATIONS.some((d) => des.includes(d));
};

// Helper: populate & resolve companyId from a team document safely
const getTeamTenantId = (team) => {
  if (!team) return null;
  return team.companyId || getTenantId(team.createdBy) || null;
};

// ── Create Team (strictly tenant-isolated) ───────────────────────────────────
exports.createTeam = async (req, res) => {
  try {
    if (!canManageTeam(req.user))
      return res.status(403).json({ message: 'Not authorized to create teams' });

    const tenantId = req.tenantId || getTenantId(req.user);
    const { projectName, members, teamLead, startDate, endDate, techStack } = req.body;

    // Validate all assigned members & teamLead belong strictly to this company
    const companyUserIds = new Set(
      (await User.find(getTenantUserFilter(tenantId)).distinct('_id')).map((id) => id.toString())
    );
    const safeMembers = (members || []).filter((m) => companyUserIds.has(m.toString()));
    const safeLead = teamLead && companyUserIds.has(teamLead.toString()) ? teamLead : null;

    const team = await Team.create({
      companyId: tenantId,
      projectName,
      members: safeMembers,
      teamLead: safeLead,
      createdBy: req.user._id,
      startDate: startDate || null,
      endDate: endDate || null,
      techStack: Array.isArray(techStack) ? techStack : (techStack ? [techStack] : []),
    });
    const populated = await Team.findById(team._id)
      .populate('members', 'name designation role profilePicture employeeCode')
      .populate('teamLead', 'name designation role profilePicture employeeCode')
      .populate('createdBy', 'name designation role profilePicture employeeCode');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const processTeamExpirations = async (tenantFilterId = null) => {
  try {
    const query = tenantFilterId
      ? { companyId: tenantFilterId, status: 'Active' }
      : { status: 'Active' };

    const activeTeams = await Team.find(query)
      .populate('members', 'name designation role profilePicture employeeCode')
      .populate('teamLead', 'name designation role profilePicture employeeCode')
      .populate('createdBy', 'name designation role profilePicture employeeCode companyId');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const team of activeTeams) {
      if (!team.endDate) continue;

      const teamTenantId = getTeamTenantId(team);
      const endDate = new Date(team.endDate);
      endDate.setHours(23, 59, 59, 999);

      const oneDayBeforeEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      oneDayBeforeEnd.setHours(0, 0, 0, 0);

      // 1. Expiry Warning: 1 day before End Date (notify ONLY this team's company Admins/HR/PMs)
      if (today >= oneDayBeforeEnd && today <= endDate && !team.expiryWarningSent) {
        const targetUserIds = new Set();
        if (team.createdBy?._id) targetUserIds.add(team.createdBy._id.toString());
        if (team.teamLead?._id) targetUserIds.add(team.teamLead._id.toString());

        if (teamTenantId) {
          const pms = await User.find({
            ...getTenantUserFilter(teamTenantId),
            $and: [
              {
                $or: [
                  { role: { $in: ['Admin', 'HR'] } },
                  { designation: { $regex: /project manager|program manager|operations manager/i } },
                ],
              },
            ],
          }).select('_id');
          pms.forEach((p) => targetUserIds.add(p._id.toString()));
        }

        const formattedDate = new Date(team.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        for (const uid of targetUserIds) {
          await Notification.create({
            companyId: teamTenantId,
            userId: uid,
            type: 'team_expiry_warning',
            title: `⚠️ Team End Date Approaching: ${team.projectName}`,
            message: `Team "${team.projectName}" (${team.teamId}) is scheduled to end on ${formattedDate}. Click here to extend the project end date.`,
            link: `/teams?openTeam=${team._id}&extend=true`,
          });
        }

        team.expiryWarningSent = true;
        await team.save();
      }

      // 2. Auto-completion & Archival: After End Date has passed
      if (today > endDate) {
        await TeamHistory.create({
          companyId: teamTenantId,
          teamId: team.teamId || `TM-${String(team._id).slice(-4).toUpperCase()}`,
          projectName: team.projectName,
          members: (team.members || []).map((m) => ({
            _id: m._id,
            name: m.name,
            employeeCode: m.employeeCode,
            designation: m.designation,
            role: m.role,
            profilePicture: m.profilePicture,
          })),
          teamLead: team.teamLead
            ? {
                _id: team.teamLead._id,
                name: team.teamLead.name,
                employeeCode: team.teamLead.employeeCode,
                designation: team.teamLead.designation,
                role: team.teamLead.role,
                profilePicture: team.teamLead.profilePicture,
              }
            : null,
          createdBy: team.createdBy
            ? {
                _id: team.createdBy._id,
                name: team.createdBy.name,
                employeeCode: team.createdBy.employeeCode,
                designation: team.createdBy.designation,
                role: team.createdBy.role,
                profilePicture: team.createdBy.profilePicture,
              }
            : null,
          startDate: team.startDate,
          endDate: team.endDate,
          completedAt: new Date(),
          techStack: team.techStack || [],
          status: 'Completed',
          documents: team.documents || [],
          progressUpdates: team.progressUpdates || [],
          shifts: team.shifts || [],
          reasonArchived: 'Auto-completed after project end date expired',
        });

        if (team.teamId) {
          for (const s of (team.shifts || [])) {
            const empId = s.employeeId?._id || s.employeeId;
            if (empId && s.date) {
              const dateStr = new Date(s.date).toISOString().split('T')[0];
              const start = new Date(dateStr + 'T00:00:00.000Z');
              const end = new Date(dateStr + 'T23:59:59.999Z');
              await ShiftSchedule.updateMany(
                { employeeId: empId, date: { $gte: start, $lte: end } },
                { $set: { teamId: team.teamId } }
              );
            }
          }
        }

        const targetUserIds = new Set();
        if (team.createdBy?._id) targetUserIds.add(team.createdBy._id.toString());
        if (team.teamLead?._id) targetUserIds.add(team.teamLead._id.toString());

        for (const uid of targetUserIds) {
          await Notification.create({
            companyId: teamTenantId,
            userId: uid,
            type: 'team_auto_archived',
            title: `✅ Team Completed & Archived: ${team.projectName}`,
            message: `Team "${team.projectName}" (${team.teamId}) reached its end date and has been automatically completed and moved to Team History.`,
            link: `/teams?viewHistory=true`,
          });
        }

        await Team.findByIdAndDelete(team._id);
        await TeamChat.deleteMany({ teamId: team._id });
      }
    }
  } catch (err) {
    console.error('Error in processTeamExpirations:', err);
  }
};

// ── Get all teams for current user (strictly tenant-isolated) ────────────────
exports.getTeams = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    await processTeamExpirations(tenantId);
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);
    const query = isAdmin
      ? { companyId: tenantId }
      : {
          companyId: tenantId,
          $or: [
            { members: req.user._id },
            { createdBy: req.user._id },
            { teamLead: req.user._id },
          ],
        };
    const teams = await Team.find(query)
      .sort({ createdAt: -1 })
      .populate('members', 'name designation role profilePicture employeeCode')
      .populate('teamLead', 'name designation role profilePicture employeeCode')
      .populate('createdBy', 'name designation role profilePicture employeeCode')
      .populate('progressUpdates.submittedBy', 'name designation')
      .populate('progressUpdates.pmApprovedBy', 'name')
      .populate('progressUpdates.dmApprovedBy', 'name')
      .populate('shifts.employeeId', 'name designation profilePicture employeeCode')
      .populate('shifts.scheduledBy', 'name');
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get single team (tenant-isolated) ────────────────────────────────────────
exports.getTeamById = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id)
      .populate('members', 'name designation role profilePicture employeeCode department weeklyHolidays holidayStartDate holidayValidUntil')
      .populate('teamLead', 'name designation role profilePicture employeeCode')
      .populate('createdBy', 'name designation role profilePicture employeeCode')
      .populate('progressUpdates.submittedBy', 'name designation profilePicture')
      .populate('progressUpdates.pmApprovedBy', 'name')
      .populate('progressUpdates.dmApprovedBy', 'name')
      .populate('progressUpdates.rejectedBy', 'name')
      .populate('shifts.employeeId', 'name designation profilePicture employeeCode')
      .populate('shifts.scheduledBy', 'name')
      .populate('documents.uploadedBy', 'name');
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }
    res.json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update Team (tenant-isolated) ────────────────────────────────────────────
exports.updateTeam = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    const isCreator = team.createdBy.toString() === req.user._id.toString();
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);
    const isLead = team.teamLead && team.teamLead.toString() === req.user._id.toString();
    if (!isCreator && !isAdmin && !isLead && !canManageTeam(req.user))
      return res.status(403).json({ message: 'Not authorized' });

    const { projectName, members, teamLead, startDate, endDate, techStack, status } = req.body;
    if (projectName !== undefined) team.projectName = projectName;
    if (members !== undefined || teamLead !== undefined) {
      const companyUserIds = new Set(
        (await User.find(getTenantUserFilter(tenantId)).distinct('_id')).map((id) => id.toString())
      );
      if (members !== undefined) team.members = members.filter((m) => companyUserIds.has(m.toString()));
      if (teamLead !== undefined) team.teamLead = teamLead && companyUserIds.has(teamLead.toString()) ? teamLead : null;
    }
    if (startDate !== undefined) team.startDate = startDate ? startDate : null;

    if (endDate !== undefined) {
      const oldEndDateStr = team.endDate ? new Date(team.endDate).toISOString().split('T')[0] : '';
      const newEndDateStr = endDate ? new Date(endDate).toISOString().split('T')[0] : '';

      if (newEndDateStr !== oldEndDateStr) {
        const isPMOrAdmin = ['Admin', 'HR'].includes(req.user.role) ||
          /project manager|program manager|operations manager/i.test(req.user.designation || req.user.role || '');

        if (!isPMOrAdmin) {
          return res.status(403).json({ message: 'Only Project Managers and Admins are authorized to extend or modify the project End Date.' });
        }
        team.endDate = endDate ? endDate : null;
        team.expiryWarningSent = false;
      }
    }

    if (techStack !== undefined) team.techStack = Array.isArray(techStack) ? techStack : [techStack];
    if (status !== undefined) team.status = status;

    await team.save();
    const updated = await Team.findById(team._id)
      .populate('members', 'name designation role profilePicture employeeCode department weeklyHolidays holidayStartDate holidayValidUntil')
      .populate('teamLead', 'name designation role profilePicture employeeCode')
      .populate('createdBy', 'name designation role profilePicture employeeCode')
      .populate('progressUpdates.submittedBy', 'name designation profilePicture')
      .populate('progressUpdates.pmApprovedBy', 'name')
      .populate('progressUpdates.dmApprovedBy', 'name')
      .populate('progressUpdates.rejectedBy', 'name')
      .populate('shifts.employeeId', 'name designation profilePicture')
      .populate('shifts.scheduledBy', 'name')
      .populate('documents.uploadedBy', 'name');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete Team (tenant-isolated) ────────────────────────────────────────────
exports.deleteTeam = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }
    const isCreator = team.createdBy.toString() === req.user._id.toString();
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);
    if (!isCreator && !isAdmin)
      return res.status(403).json({ message: 'Not authorized to delete this team' });

    const populatedTeam = await Team.findById(req.params.id)
      .populate('members', 'name designation role profilePicture employeeCode')
      .populate('teamLead', 'name designation role profilePicture employeeCode')
      .populate('createdBy', 'name designation role profilePicture employeeCode');

    if (populatedTeam) {
      await TeamHistory.create({
        companyId: tenantId,
        teamId: populatedTeam.teamId || `TM-${String(populatedTeam._id).slice(-4).toUpperCase()}`,
        projectName: populatedTeam.projectName,
        members: (populatedTeam.members || []).map((m) => ({
          _id: m._id,
          name: m.name,
          employeeCode: m.employeeCode,
          designation: m.designation,
          role: m.role,
          profilePicture: m.profilePicture,
        })),
        teamLead: populatedTeam.teamLead
          ? {
              _id: populatedTeam.teamLead._id,
              name: populatedTeam.teamLead.name,
              employeeCode: populatedTeam.teamLead.employeeCode,
              designation: populatedTeam.teamLead.designation,
              role: populatedTeam.teamLead.role,
              profilePicture: populatedTeam.teamLead.profilePicture,
            }
          : null,
        createdBy: populatedTeam.createdBy
          ? {
              _id: populatedTeam.createdBy._id,
              name: populatedTeam.createdBy.name,
              employeeCode: populatedTeam.createdBy.employeeCode,
              designation: populatedTeam.createdBy.designation,
              role: populatedTeam.createdBy.role,
              profilePicture: populatedTeam.createdBy.profilePicture,
            }
          : null,
        startDate: populatedTeam.startDate,
        endDate: populatedTeam.endDate,
        completedAt: new Date(),
        techStack: populatedTeam.techStack || [],
        status: populatedTeam.status || 'Active',
        documents: populatedTeam.documents || [],
        progressUpdates: populatedTeam.progressUpdates || [],
        shifts: populatedTeam.shifts || [],
        reasonArchived: `Team deleted by ${req.user.name}`,
      });
    }

    if (team.teamId) {
      for (const s of (team.shifts || [])) {
        const empId = s.employeeId?._id || s.employeeId;
        if (empId && s.date) {
          const dateStr = new Date(s.date).toISOString().split('T')[0];
          const start = new Date(dateStr + 'T00:00:00.000Z');
          const end = new Date(dateStr + 'T23:59:59.999Z');
          await ShiftSchedule.updateMany(
            { employeeId: empId, date: { $gte: start, $lte: end } },
            { $set: { teamId: team.teamId } }
          );
        }
      }

      if (team.members && team.members.length > 0) {
        const query = { employeeId: { $in: team.members } };
        if (team.startDate && team.endDate) {
          query.date = { $gte: team.startDate, $lte: team.endDate };
        }
        await ShiftSchedule.updateMany(query, { $set: { teamId: team.teamId } });
      }
    }

    await Team.findByIdAndDelete(req.params.id);
    await TeamChat.deleteMany({ teamId: req.params.id });
    res.json({ message: 'Team deleted & archived to Team History' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Submit Progress Update (tenant-isolated) ─────────────────────────────────
exports.addProgressUpdate = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });
    team.progressUpdates.push({ message, submittedBy: req.user._id });
    await team.save();
    await team.populate('progressUpdates.submittedBy', 'name designation profilePicture');
    const update = team.progressUpdates[team.progressUpdates.length - 1];
    res.status(201).json(update);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Approve / Reject Progress Update (tenant-isolated) ──────────────────────
exports.approveProgressUpdate = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    const update = team.progressUpdates.id(req.params.updateId);
    if (!update) return res.status(404).json({ message: 'Progress update not found' });

    const { action, rejectReason } = req.body;
    const des = (req.user.designation || req.user.role || '').toLowerCase();
    const isPM = des.includes('project manager') || des.includes('program manager');
    const isDM = des.includes('delivery manager') || des.includes('operations manager');
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);

    if (action === 'pm-approve') {
      if (!isPM && !isAdmin) return res.status(403).json({ message: 'Only PM can approve at this stage' });
      update.status = 'PM Approved';
      update.pmApprovedBy = req.user._id;
      update.pmApprovedAt = new Date();
    } else if (action === 'dm-approve') {
      if (!isDM && !isAdmin) return res.status(403).json({ message: 'Only DM can approve at this stage' });
      update.status = 'DM Approved';
      update.dmApprovedBy = req.user._id;
      update.dmApprovedAt = new Date();
    } else if (action === 'reject') {
      update.status = 'Rejected';
      update.rejectedBy = req.user._id;
      update.rejectReason = rejectReason || '';
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await team.save();
    res.json(update);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Upload / Write Document (tenant-isolated) ────────────────────────────────
exports.addDocument = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    let doc;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'employee_tracker/documents',
        resource_type: 'auto',
      });

      doc = {
        type: 'file',
        filename: req.file.originalname,
        fileUrl: result.secure_url,
        uploadedBy: req.user._id,
      };
    } else {
      const { content, filename } = req.body;
      if (!content) return res.status(400).json({ message: 'Content is required for text documents' });
      doc = { type: 'text', filename: filename || 'Untitled', content, uploadedBy: req.user._id };
    }

    team.documents.push(doc);
    await team.save();
    await team.populate('documents.uploadedBy', 'name');
    res.status(201).json(team.documents[team.documents.length - 1]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete Document (tenant-isolated) ────────────────────────────────────────
exports.deleteDocument = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }
    const doc = team.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const isUploader = doc.uploadedBy && doc.uploadedBy.toString() === req.user._id.toString();
    const isCreator = team.createdBy && team.createdBy.toString() === req.user._id.toString();
    const isLead = team.teamLead && team.teamLead.toString() === req.user._id.toString();
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);
    if (!isUploader && !isCreator && !isLead && !isAdmin && !canManageTeam(req.user)) {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }

    if (doc.type === 'file' && doc.fileUrl) {
      const publicId = getCloudinaryPublicId(doc.fileUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
        } catch (delErr) {
          console.warn('Failed to delete document from Cloudinary:', delErr.message);
        }
      }
    }
    team.documents.pull(req.params.docId);
    await team.save();
    res.json({ message: 'Document deleted', docId: req.params.docId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Schedule Shift (tenant-isolated) ─────────────────────────────────────────
exports.scheduleShift = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    const des = (req.user.designation || req.user.role || '').toLowerCase();
    const canSchedule = des.includes('team lead') || des.includes('project manager') ||
      des.includes('program manager') || ['Admin', 'HR'].includes(req.user.role);
    const isLead = team.teamLead && team.teamLead.toString() === req.user._id.toString();
    const isCreator = team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!canSchedule && !isLead && !isCreator) {
      return res.status(403).json({ message: 'Only Team Lead or PM can schedule shifts' });
    }

    const { employeeId, shiftType, date, isLocked } = req.body;

    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');
    const existingGlobal = await ShiftSchedule.findOne({ employeeId, date: { $gte: start, $lte: end } });

    const finalIsLocked = existingGlobal ? existingGlobal.isLocked : Boolean(isLocked);

    team.shifts.push({ employeeId, shiftType, date, scheduledBy: req.user._id, isLocked: finalIsLocked });
    await team.save();

    if (existingGlobal) {
      if (!existingGlobal.companyId) existingGlobal.companyId = tenantId;
      if (!existingGlobal.isLocked) {
        existingGlobal.shiftType = shiftType;
        existingGlobal.scheduledBy = req.user._id;
      }
      existingGlobal.teamId = team.teamId;
      if (isLocked) existingGlobal.isLocked = true;
      await existingGlobal.save();
    } else {
      await ShiftSchedule.create({
        companyId: tenantId,
        employeeId,
        shiftType,
        date: start,
        scheduledBy: req.user._id,
        teamId: team.teamId,
        isLocked: finalIsLocked,
      });
    }

    await team.populate('shifts.employeeId', 'name designation profilePicture employeeCode');
    await team.populate('shifts.scheduledBy', 'name');
    const shift = team.shifts[team.shifts.length - 1];
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete Shift (tenant-isolated) ───────────────────────────────────────────
exports.deleteShift = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id);
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }
    const shift = team.shifts.id(req.params.shiftId);
    if (!shift) return res.status(404).json({ message: 'Shift not found' });

    const des = (req.user.designation || req.user.role || '').toLowerCase();
    const canSchedule = des.includes('team lead') || des.includes('project manager') ||
      des.includes('program manager') || ['Admin', 'HR'].includes(req.user.role);
    const isLead = team.teamLead && team.teamLead.toString() === req.user._id.toString();
    const isCreator = team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!canSchedule && !isLead && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to delete shift' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0);
    const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);

    const start = new Date(shift.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(shift.date);
    end.setHours(23, 59, 59, 999);

    const empId = shift.employeeId?._id || shift.employeeId;
    const globalShift = await ShiftSchedule.findOne({ employeeId: empId, date: { $gte: start, $lte: end } });

    if (globalShift?.isLocked || shift.isLocked || today >= lockThreshold) {
      return res.status(400).json({
        message: 'Cannot delete shift less than 1 day before it occurs, after it has passed, or when locked.',
      });
    }

    if (globalShift) {
      await ShiftSchedule.findByIdAndDelete(globalShift._id);
    }

    team.shifts.pull(req.params.shiftId);
    await team.save();
    res.json({ message: 'Shift deleted', shiftId: req.params.shiftId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Team Attendance Sheet (tenant-isolated) ──────────────────────────────────
exports.getTeamAttendance = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id).populate('members', 'name designation role profilePicture employeeCode department weeklyHolidays holidayStartDate holidayValidUntil');
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    const des = (req.user.designation || req.user.role || '').toLowerCase();
    const isLeadOrPM = des.includes('team lead') || des.includes('project manager') ||
      des.includes('program manager') || ['Admin', 'HR'].includes(req.user.role);
    const isLead = team.teamLead && team.teamLead.toString() === req.user._id.toString();
    const isCreator = team.createdBy && team.createdBy.toString() === req.user._id.toString();
    if (!isLeadOrPM && !isLead && !isCreator) {
      return res.status(403).json({ message: 'Only Team Lead or PM can view team attendance' });
    }

    const { month, year } = req.query;
    const now = new Date();
    const monthStr = (month || (now.getMonth() + 1)).toString().padStart(2, '0');
    const yearStr = (year || now.getFullYear()).toString();

    const memberIds = (team.members || []).map((m) => m._id);
    const records = await Attendance.find({
      companyId: tenantId,
      employeeId: { $in: memberIds },
      date: { $regex: `^${yearStr}-${monthStr}` },
    }).sort({ date: 1 });

    res.json({ team, records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get Chat Messages (tenant-isolated) ──────────────────────────────────────
exports.getChatMessages = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id).select('companyId createdBy');
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    const msgs = await TeamChat.find({ teamId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('senderId', 'name profilePicture designation role');
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Send Chat Message (REST fallback — tenant-isolated) ─────────────────────
exports.sendChatMessage = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const team = await Team.findById(req.params.id).select('companyId createdBy');
    if (!team || !belongsToTenant(team, tenantId)) {
      return res.status(404).json({ message: 'Team not found in your organization' });
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });
    const msg = await TeamChat.create({
      companyId: tenantId,
      teamId: req.params.id,
      senderId: req.user._id,
      message,
    });
    await msg.populate('senderId', 'name profilePicture designation role');
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get Team History & Archives (tenant-isolated) ────────────────────────────
exports.getTeamHistory = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);
    const des = (req.user.designation || req.user.role || '').toLowerCase();
    const isPM = des.includes('project manager') || des.includes('program manager') || des.includes('operations manager');

    let query = { companyId: tenantId };
    if (!isAdmin && !isPM) {
      query = {
        companyId: tenantId,
        $or: [
          { 'members._id': req.user._id },
          { members: req.user._id },
          { 'teamLead._id': req.user._id },
          { teamLead: req.user._id },
          { 'createdBy._id': req.user._id },
          { createdBy: req.user._id },
        ],
      };
    }

    const history = await TeamHistory.find(query).sort({ completedAt: -1, createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete Single Team History Archive (tenant-isolated) ───────────────────────
exports.deleteTeamHistory = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const isAdmin = ['Admin', 'HR'].includes(req.user.role);
    const des = (req.user.designation || req.user.role || '').toLowerCase();
    const isPM = des.includes('project manager') || des.includes('program manager') || des.includes('operations manager');
    if (!isAdmin && !isPM) {
      return res.status(403).json({ message: 'Not authorized to delete history records' });
    }

    const historyItem = await TeamHistory.findById(req.params.id);
    if (!historyItem || !belongsToTenant(historyItem, tenantId)) {
      return res.status(404).json({ message: 'History record not found in your organization' });
    }

    await TeamHistory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team history record deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Edit Chat Message (only sender, within 10 minutes) ──────────────────────
exports.editChatMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const msg = await TeamChat.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }
    if (msg.isDeleted) {
      return res.status(400).json({ message: 'Cannot edit a deleted message' });
    }

    const tenMin = 10 * 60 * 1000;
    if (Date.now() - msg.createdAt.getTime() > tenMin) {
      return res.status(400).json({ message: 'Edit window expired (10 minutes)' });
    }

    msg.message = message.trim();
    msg.isEdited = true;
    msg.editedAt = new Date();
    await msg.save();

    if (global.io) {
      global.io.to(`team-${msg.teamId.toString()}`).emit('message-edited', {
        _id: msg._id,
        teamId: msg.teamId,
        message: msg.message,
        isEdited: true,
        editedAt: msg.editedAt,
      });
    }

    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete Chat Message (soft-delete, only sender) ──────────────────────────
exports.deleteChatMessage = async (req, res) => {
  try {
    const msg = await TeamChat.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }
    if (msg.isDeleted) {
      return res.status(400).json({ message: 'Message already deleted' });
    }

    msg.isDeleted = true;
    msg.message = '[deleted]';
    await msg.save();

    if (global.io) {
      global.io.to(`team-${msg.teamId.toString()}`).emit('message-deleted', {
        _id: msg._id,
        teamId: msg.teamId,
      });
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

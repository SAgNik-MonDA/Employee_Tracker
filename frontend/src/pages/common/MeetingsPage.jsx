import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/common/UserAvatar';
import MeetingStatsCard from '../../components/common/MeetingStatsCard';
import toast from 'react-hot-toast';
import {
  HiOutlineVideoCamera as IconVideo,
  HiOutlinePlus as IconPlus,
  HiOutlineX as IconX,
  HiOutlineCalendar as IconCalendar,
  HiOutlineClock as IconClock,
  HiOutlineExternalLink as IconLink,
  HiOutlineDocumentText as IconDoc,
  HiOutlineCheckCircle as IconCheck,
  HiOutlineXCircle as IconCross,
  HiOutlineUserGroup as IconGroup,
  HiOutlineSearch as IconSearch,
} from 'react-icons/hi';

const CREATOR_KEYWORDS = [
  'project manager', 'executive assistant', 'hr',
  'business analyst', 'account manager', 'admin',
  'program manager', 'delivery manager'
];

const MeetingsPage = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMomModal, setShowMomModal] = useState(false);
  const [showViewMomModal, setShowViewMomModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showRejoinModal, setShowRejoinModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    meetingLink: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    entryTimeLimitMinutes: 15,
    invitedEmployees: [],
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const [momText, setMomText] = useState('');
  const [attendanceState, setAttendanceState] = useState({});
  const [submittingMom, setSubmittingMom] = useState(false);

  const [rejoinReason, setRejoinReason] = useState('');
  const [submittingRejoin, setSubmittingRejoin] = useState(false);

  const MANAGEMENT_KEYWORDS = [
    'technical lead', 'team lead', 'project manager', 'program manager',
    'delivery manager', 'operations manager', 'business analyst',
    'account manager', 'executive assistant', 'hr', 'hr executive', 'hr manager',
    'director', 'director of technology', 'vice president', 'vp',
    'chief technology officer', 'cto', 'chief executive officer', 'ceo',
    'chief operating officer', 'coo', 'chief information officer', 'cio',
    'managing director', 'admin', 'ciso', 'cfo', 'cmo'
  ];

  const isMgmtUser = (u) => {
    if (!u) return false;
    if (['Admin', 'HR', 'CEO', 'CTO', 'COO', 'CIO', 'CISO', 'Chief Financial Officer (CFO)'].includes(u.role)) return true;
    const role = (u.role || '').toLowerCase();
    const desig = (u.designation || '').toLowerCase();
    return MANAGEMENT_KEYWORDS.some((kw) => role.includes(kw) || desig.includes(kw));
  };

  const getEmployeeObject = (emp, empList) => {
    if (!emp) return { _id: 'unknown', name: 'Employee', role: '', designation: '' };
    if (typeof emp === 'object' && emp.name) return emp;
    const empIdStr = typeof emp === 'string' ? emp : (emp._id || emp.employeeId?._id || emp.employeeId)?.toString();
    const found = (empList || []).find((e) => e._id?.toString() === empIdStr);
    if (found) return found;
    return typeof emp === 'object' ? emp : { _id: empIdStr, name: 'Employee', role: '', designation: '' };
  };

  const canCreate = (() => {

    if (!user) return false;
    if (user.role === 'Admin' || user.role === 'HR') return true;
    const role = (user.role || '').toLowerCase();
    const desig = (user.designation || '').toLowerCase();
    return CREATOR_KEYWORDS.some((kw) => role.includes(kw) || desig.includes(kw));
  })();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [meetingsRes, empRes] = await Promise.all([
        API.get('/meetings'),
        API.get('/auth/employees').catch(() => ({ data: [] })),
      ]);
      setMeetings(meetingsRes.data);
      setEmployees(empRes.data);
    } catch (err) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.invitedEmployees || createForm.invitedEmployees.length === 0) {
      toast.error('Please select at least one employee to invite');
      return;
    }
    setSubmittingCreate(true);
    try {
      await API.post('/meetings', createForm);
      toast.success('Meeting scheduled & notifications sent! 📅');
      setShowCreateModal(false);
      setCreateForm({
        title: '',
        description: '',
        meetingLink: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        entryTimeLimitMinutes: 15,
        invitedEmployees: [],
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoinCall = async (meeting) => {
    try {
      const { data } = await API.post(`/meetings/${meeting._id}/join`);
      toast.success('Joining video call... 🎥');
      fetchData();
      if (data.meetingLink) {
        const link = data.meetingLink.startsWith('http') ? data.meetingLink : `https://${data.meetingLink}`;
        window.open(link, '_blank');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join meeting');
    }
  };

  const handleRejoinSubmit = async (e) => {
    e.preventDefault();
    if (!rejoinReason.trim()) {
      toast.error('Please state the reason for leaving');
      return;
    }
    setSubmittingRejoin(true);
    try {
      await API.post(`/meetings/${selectedMeeting._id}/rejoin-request`, { reason: rejoinReason });
      toast.success('Rejoin request submitted to meeting creator! 📩');
      setShowRejoinModal(false);
      setRejoinReason('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit rejoin request');
    } finally {
      setSubmittingRejoin(false);
    }
  };

  const handleRejoinAction = async (meetingId, requestId, action) => {
    try {
      await API.put(`/meetings/${meetingId}/rejoin-request/${requestId}`, { action });
      toast.success(action === 'approve' ? 'Rejoin request approved! ✅' : 'Rejoin request declined.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update rejoin request');
    }
  };

  const handleOpenMomModal = (meeting) => {
    setSelectedMeeting(meeting);
    setMomText(meeting.momText || '');
    const initialAtt = {};
    const targetList = meeting.manualInvitedEmployees && meeting.manualInvitedEmployees.length > 0
      ? meeting.manualInvitedEmployees
      : meeting.invitedEmployees;

    (targetList || []).forEach((emp) => {
      const empId = emp._id || emp;
      const existing = (meeting.attendance || []).find(
        (a) => (a.employeeId?._id || a.employeeId) === empId
      );
      initialAtt[empId] = existing && existing.status !== 'Pending' ? existing.status : 'Present';
    });
    setAttendanceState(initialAtt);
    setShowMomModal(true);
  };

  const handleMomSubmit = async (e) => {
    e.preventDefault();
    if (!momText.trim()) {
      toast.error('Please write the Minutes of Meeting (MOM)');
      return;
    }
    setSubmittingMom(true);
    try {
      const attendancePayload = Object.entries(attendanceState).map(([empId, status]) => ({
        employeeId: empId,
        status,
      }));

      await API.put(`/meetings/${selectedMeeting._id}/mom`, {
        momText,
        attendance: attendancePayload,
      });

      toast.success('MOM & Attendance published to participants! 📝');
      setShowMomModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit MOM');
    } finally {
      setSubmittingMom(false);
    }
  };

  const toggleEmployeeInvite = (empId) => {
    setCreateForm((prev) => {
      const list = prev.invitedEmployees;
      if (list.includes(empId)) {
        return { ...prev, invitedEmployees: list.filter((id) => id !== empId) };
      } else {
        return { ...prev, invitedEmployees: [...list, empId] };
      }
    });
  };

  // Exclude management/leadership roles from manual invite checklist!
  const regularEmployeesOnly = employees.filter((e) => !isMgmtUser(e));

  const handleSelectAllEmployees = () => {
    const allIds = regularEmployeesOnly.map((e) => e._id);
    setCreateForm((prev) => ({ ...prev, invitedEmployees: allIds }));
  };

  const handleClearAllEmployees = () => {
    setCreateForm((prev) => ({ ...prev, invitedEmployees: [] }));
  };

  const filteredEmployeesForInvite = regularEmployeesOnly.filter(
    (e) =>
      e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
      (e.designation || '').toLowerCase().includes(empSearch.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(empSearch.toLowerCase())
  );


  const parseMeetingDateTimeHelper = (dateVal, timeStr) => {
    if (!dateVal) return new Date();
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
    const hh = String(hours || 0).padStart(2, '0');
    const mm = String(minutes || 0).padStart(2, '0');
    return new Date(`${year}-${month}-${day}T${hh}:${mm}:00`);
  };


  const nowTime = new Date();


  const isMeetingPast = (m) => {
    if (m.status === 'Completed' || m.status === 'Cancelled' || m.isMomPublished) return true;
    const endDateTime = parseMeetingDateTimeHelper(m.date, m.endTime);
    return nowTime > endDateTime;
  };

  const upcomingMeetings = meetings.filter((m) => !isMeetingPast(m));
  const pastMeetings = meetings.filter((m) => isMeetingPast(m));
  const createdMeetings = meetings.filter((m) => (m.createdBy?._id || m.createdBy) === user?._id);



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-100 flex items-center gap-2.5">
            <IconVideo className="w-7 h-7 text-primary-400" /> Meetings &amp; MOM Portal
          </h1>
          <p className="text-surface-500 mt-1">Schedule meetings, join video calls, record attendance &amp; view MOMs</p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 w-fit shadow-lg shadow-primary-500/20"
          >
            <IconPlus className="w-5 h-5" /> Schedule New Meeting
          </button>
        )}
      </div>

      {/* Creator Summary Stats */}
      {canCreate && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-900/60 p-4 rounded-2xl border border-surface-700/50">
          <div className="p-3 rounded-xl bg-surface-800/80 border border-surface-700/40 text-center">
            <span className="text-[11px] text-surface-400 font-semibold block uppercase tracking-wider">Total Created</span>
            <span className="text-xl font-display font-bold text-primary-400">
              {createdMeetings.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <span className="text-[11px] text-emerald-300/80 font-semibold block uppercase tracking-wider">Completed / Past</span>
            <span className="text-xl font-display font-bold text-emerald-400">
              {createdMeetings.filter((m) => isMeetingPast(m)).length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
            <span className="text-[11px] text-cyan-300/80 font-semibold block uppercase tracking-wider">Upcoming Scheduled</span>
            <span className="text-xl font-display font-bold text-cyan-400">
              {createdMeetings.filter((m) => !isMeetingPast(m)).length}
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-700/50 pb-3">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'upcoming'
              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
              : 'text-surface-400 hover:bg-surface-800'
          }`}
        >
          <IconCalendar className="w-4 h-4" /> Upcoming ({upcomingMeetings.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'past'
              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
              : 'text-surface-400 hover:bg-surface-800'
          }`}
        >
          <IconDoc className="w-4 h-4" /> Past Meetings &amp; MOM ({pastMeetings.length})
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'stats'
              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
              : 'text-surface-400 hover:bg-surface-800'
          }`}
        >
          <IconGroup className="w-4 h-4" /> My Attendance Summary
        </button>
        {canCreate && (
          <button
            onClick={() => setActiveTab('created')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'created'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-surface-400 hover:bg-surface-800'
            }`}
          >
            <IconVideo className="w-4 h-4 text-violet-400" /> Meetings Created by Me ({createdMeetings.length})
          </button>
        )}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="glass-card p-8 text-center text-surface-400">Loading meetings...</div>
      ) : activeTab === 'stats' ? (
        <MeetingStatsCard />
      ) : activeTab === 'created' ? (
        <div className="space-y-4">
          {createdMeetings.length === 0 ? (
            <div className="glass-card p-12 text-center text-surface-500">
              <IconVideo className="w-12 h-12 mx-auto mb-3 text-surface-600" />
              <p className="text-base font-medium">You haven't created any meetings yet.</p>
            </div>
          ) : (
            createdMeetings.map((m) => {
              const isPast = isMeetingPast(m);
              const targetList = m.manualInvitedEmployees && m.manualInvitedEmployees.length > 0
                ? m.manualInvitedEmployees
                : m.invitedEmployees;

              return (
                <div key={m._id} className="glass-card p-6 border border-surface-700/50 hover:border-surface-600/50 transition-all space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-700/40">
                    <div>
                      <span className="text-xs text-violet-400 font-bold uppercase tracking-wider">Created By You</span>
                      <h3 className="text-lg font-display font-bold text-surface-100 mt-0.5">{m.title}</h3>
                      {m.description && <p className="text-sm text-surface-400 mt-1">{m.description}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        isPast || m.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        m.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {isPast || m.status === 'Completed' ? 'Completed' : m.status}
                      </span>
                    </div>
                  </div>

                  {/* Meeting Details Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-800/60 p-3.5 rounded-xl border border-surface-700/40">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-surface-300">
                      <span className="flex items-center gap-1.5 text-surface-400">
                        <IconCalendar className="w-4 h-4 text-primary-400" />
                        {new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1.5 text-surface-400">
                        <IconClock className="w-4 h-4 text-amber-400" />
                        {m.startTime} – {m.endTime}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenMomModal(m)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <IconDoc className="w-4 h-4" /> {m.isMomPublished ? 'Edit MOM & Attendance' : 'Write MOM & Take Attendance'}
                    </button>
                  </div>

                  {/* MOM Content Box if Published */}
                  {m.isMomPublished && (
                    <div className="bg-violet-500/10 border border-violet-500/30 p-4 rounded-xl space-y-1.5">
                      <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                        <IconDoc className="w-4 h-4" /> Published Minutes of Meeting (MOM):
                      </h4>
                      <p className="text-xs text-surface-200 whitespace-pre-wrap leading-relaxed">
                        {m.momText}
                      </p>
                      {m.momSubmittedAt && (
                        <p className="text-[10px] text-surface-500 pt-2 border-t border-violet-500/20">
                          Published on {new Date(m.momSubmittedAt).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Attendance Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-surface-300 uppercase tracking-wider flex items-center gap-1.5">
                      <IconGroup className="w-4 h-4 text-violet-400" /> Invited Participants &amp; Attendance Status:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {(targetList || []).map((empItem) => {
                        const empObj = getEmployeeObject(empItem, employees);
                        const empIdStr = empObj._id?.toString() || Math.random().toString();
                        const attRecord = (m.attendance || []).find(
                          (a) => (a.employeeId?._id || a.employeeId)?.toString() === empIdStr
                        );
                        const isPresent = attRecord?.status === 'Present';

                        return (
                          <div key={empIdStr} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-900/80 border border-surface-700/50 text-xs">
                            <div className="flex items-center gap-2">
                              <UserAvatar user={empObj} size="xs" />
                              <div>
                                <span className="font-bold text-surface-100 block">{empObj.name || 'Employee'}</span>
                                <span className="text-[10px] text-surface-400">{empObj.designation || empObj.role || ''}</span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPresent ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}>
                              {isPresent ? 'Present' : 'Absent'}
                            </span>
                          </div>
                        );
                      })}

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(activeTab === 'upcoming' ? upcomingMeetings : pastMeetings).length === 0 ? (
            <div className="glass-card p-12 text-center text-surface-500">
              <IconVideo className="w-12 h-12 mx-auto mb-3 text-surface-600" />
              <p className="text-base font-medium">No {activeTab} meetings found</p>
            </div>
          ) : (
            (activeTab === 'upcoming' ? upcomingMeetings : pastMeetings).map((m) => {

              const isCreator = (m.createdBy?._id || m.createdBy) === user?._id;
              const userAtt = (m.attendance || []).find(
                (a) => (a.employeeId?._id || a.employeeId) === user?._id
              );
              const userStatus = userAtt ? userAtt.status : 'Pending';

              const isPast = isMeetingPast(m);
              const isUserJoined = (m.joinedUsers || []).some((j) => (j.userId?._id || j.userId)?.toString() === user?._id?.toString());
              const isUserPresent = userStatus === 'Present' || isUserJoined;

              return (
                <div key={m._id} className="glass-card p-6 border border-surface-700/50 hover:border-surface-600/50 transition-all space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-700/40">
                    <div className="flex items-start gap-4">
                      <UserAvatar user={m.createdBy} size="md" />
                      <div>
                        <span className="text-xs text-primary-400 font-medium">
                          Created by {m.createdBy?.name || 'Manager'} • {m.createdBy?.designation || m.createdBy?.role}
                        </span>
                        <h3 className="text-lg font-display font-bold text-surface-100 mt-0.5">{m.title}</h3>
                        {m.description && <p className="text-sm text-surface-400 mt-1">{m.description}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        isPast || m.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        m.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {isPast || m.status === 'Completed' ? 'Completed' : m.status}
                      </span>

                      {isPast ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${
                          isUserPresent ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {isUserPresent ? <IconCheck className="w-3.5 h-3.5" /> : <IconCross className="w-3.5 h-3.5" />}
                          Your Status: {isUserPresent ? 'Present' : 'Absent'}
                        </span>
                      ) : (
                        userStatus !== 'Pending' && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${
                            userStatus === 'Present' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                            {userStatus === 'Present' ? <IconCheck className="w-3.5 h-3.5" /> : <IconCross className="w-3.5 h-3.5" />}
                            Your Status: {userStatus}
                          </span>
                        )
                      )}
                    </div>
                  </div>


                  <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-800/60 p-3.5 rounded-xl border border-surface-700/40">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-surface-300">
                      <span className="flex items-center gap-1.5 text-surface-400">
                        <IconCalendar className="w-4 h-4 text-primary-400" />
                        {new Date(m.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1.5 text-surface-400">
                        <IconClock className="w-4 h-4 text-amber-400" />
                        {m.startTime} – {m.endTime}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedMeeting(m); setShowParticipantsModal(true); }}
                        className="flex items-center gap-1.5 text-surface-300 hover:text-primary-300 transition-colors cursor-pointer bg-surface-700/40 hover:bg-surface-700/70 px-2.5 py-1 rounded-lg border border-surface-600/30"
                      >
                        <IconGroup className="w-4 h-4 text-violet-400" />
                        <span className="font-semibold text-surface-200">{m.invitedEmployees?.length || 0} Participants Invited</span>
                        <span className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded border border-primary-500/20 ml-1">View List</span>
                      </button>
                    </div>


                    {(() => {
                      const isMgmt = isMgmtUser(user);
                      const userIdStr = user?._id?.toString();

                      const parseMeetingDateTime = (dateVal, timeStr) => {
                        if (!dateVal) return new Date();
                        const d = new Date(dateVal);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
                        const hh = String(hours || 0).padStart(2, '0');
                        const mm = String(minutes || 0).padStart(2, '0');
                        return new Date(`${year}-${month}-${day}T${hh}:${mm}:00`);
                      };

                      const startDateTime = parseMeetingDateTime(m.date, m.startTime);
                      const endDateTime = parseMeetingDateTime(m.date, m.endTime);
                      const now = new Date();


                      const entryLimitMins = m.entryTimeLimitMinutes || 15;
                      const entryDeadline = new Date(startDateTime.getTime() + entryLimitMins * 60 * 1000);

                      const hasJoined = (m.joinedUsers || []).some((j) => (j.userId?._id || j.userId)?.toString() === userIdStr);
                      const userRejoinReq = (m.rejoinRequests || [])
                        .slice()
                        .reverse()
                        .find((r) => (r.userId?._id || r.userId)?.toString() === userIdStr);

                      const isRejoinApproved = userRejoinReq && userRejoinReq.status === 'Approved' && hasJoined;

                      const isMeetingEnded = now > endDateTime;
                      const isEntryExpired = !isMgmt && now > entryDeadline;

                      if (isMeetingEnded) {
                        return (
                          <button disabled className="px-3.5 py-1.5 rounded-xl bg-surface-800 text-surface-500 border border-surface-700/50 text-xs font-semibold cursor-not-allowed">
                            ⏳ Meeting Ended
                          </button>
                        );
                      }

                      if (isEntryExpired) {
                        return (
                          <button disabled className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold cursor-not-allowed">
                            ⏰ Entry Window Expired ({entryLimitMins}m)
                          </button>
                        );
                      }

                      if (hasJoined && !isRejoinApproved) {
                        return (
                          <div className="flex items-center gap-2">
                            <button disabled className="px-3 py-1.5 rounded-xl bg-surface-800 text-surface-400 border border-surface-700/50 text-xs font-semibold cursor-not-allowed">
                              ✓ Joined
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedMeeting(m); setShowRejoinModal(true); }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1"
                            >
                              🔄 Request Rejoin
                            </button>
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={() => handleJoinCall(m)}
                          className="btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5 shadow-md shadow-primary-500/20"
                        >
                          <IconLink className="w-4 h-4" /> {isRejoinApproved ? '🔗 Rejoin Video Call (Approved)' : 'Join Video Call'}
                        </button>
                      );
                    })()}
                  </div>

                  {/* Pending Rejoin Requests Banner for Host/Admin */}
                  {((m.createdBy?._id || m.createdBy) === user?._id || ['Admin', 'HR'].includes(user?.role)) &&
                    (m.rejoinRequests || []).some((r) => r.status === 'Pending') && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          🔄 Rejoin Requests Pending Approval:
                        </span>
                        <div className="space-y-1.5">
                          {(m.rejoinRequests || [])
                            .filter((r) => r.status === 'Pending')
                            .map((req) => (
                              <div key={req._id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-900/90 border border-surface-700/50 text-xs">
                                <div className="flex items-center gap-2.5">
                                  <UserAvatar user={req.userId} size="xs" />
                                  <div>
                                    <span className="font-bold text-surface-100 block">{req.userId?.name || 'Employee'}</span>
                                    <span className="text-[11px] text-amber-400">Reason: {req.reason}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleRejoinAction(m._id, req._id, 'approve')}
                                    className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejoinAction(m._id, req._id, 'reject')}
                                    className="px-3 py-1 rounded-lg bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-all shadow-md shadow-rose-500/20"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      {m.isMomPublished && (
                        <button
                          onClick={() => { setSelectedMeeting(m); setShowViewMomModal(true); }}
                          className="px-3.5 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <IconDoc className="w-4 h-4" /> View Published MOM
                        </button>
                      )}

                      {(isCreator || ['Admin', 'HR'].includes(user?.role)) && (
                        <button
                          onClick={() => handleOpenMomModal(m)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <IconDoc className="w-4 h-4" /> {m.isMomPublished ? 'Edit MOM & Attendance' : 'Write MOM & Take Attendance'}
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <h2 className="text-xl font-display font-bold text-surface-100 flex items-center gap-2">
                <IconVideo className="w-6 h-6 text-primary-400" /> Schedule New Meeting
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Meeting Title *</label>
                <input
                  type="text" required value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="input-field" placeholder="e.g. Sprint Planning & Tech Review"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Agenda / Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="input-field h-20 resize-none py-2 text-sm"
                  placeholder="Key topics to discuss in the meeting..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Video Meeting Link (Google Meet / Zoom) *</label>
                <input
                  type="url" required value={createForm.meetingLink}
                  onChange={(e) => setCreateForm({ ...createForm, meetingLink: e.target.value })}
                  className="input-field" placeholder="https://meet.google.com/xyz-abc-123"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Date *</label>
                  <input
                    type="date" required value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Start Time *</label>
                  <input
                    type="time" required value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">End Time *</label>
                  <input
                    type="time" required value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Entry Limit (Mins) *</label>
                  <input
                    type="number" min="1" max="180" required value={createForm.entryTimeLimitMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, entryTimeLimitMinutes: e.target.value })}
                    className="input-field" placeholder="15"
                  />
                </div>
              </div>


              <div className="border-t border-surface-700/50 pt-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-primary-400">
                    👥 Invite Participants ({createForm.invitedEmployees.length} Selected) *
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSelectAllEmployees} className="text-xs text-primary-400 hover:underline">Select All</button>
                    <span className="text-surface-600">|</span>
                    <button type="button" onClick={handleClearAllEmployees} className="text-xs text-rose-400 hover:underline">Clear All</button>
                  </div>
                </div>

                <div className="relative mb-3">
                  <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 w-4 h-4" />
                  <input
                    type="text" value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="input-field pl-9 py-1.5 text-xs"
                    placeholder="Filter employees by name, designation or department..."
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-surface-900/60 rounded-xl border border-surface-700/50">
                  {filteredEmployeesForInvite.map((emp) => {
                    const isSelected = createForm.invitedEmployees.includes(emp._id);
                    return (
                      <div
                        key={emp._id}
                        onClick={() => toggleEmployeeInvite(emp._id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                          isSelected ? 'bg-primary-500/20 border border-primary-500/40 text-surface-100' : 'hover:bg-surface-800 text-surface-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar user={emp} size="xs" />
                          <div>
                            <span className="text-xs font-semibold block">{emp.name}</span>
                            <span className="text-[10px] text-surface-400">{emp.designation || emp.role} • {emp.department}</span>
                          </div>
                        </div>
                        <input
                          type="checkbox" checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-primary-500 bg-surface-700 border-surface-600 focus:ring-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button type="submit" disabled={submittingCreate} className="btn-primary flex-1 py-2.5 text-sm">
                  {submittingCreate ? 'Scheduling...' : '📅 Confirm & Schedule Meeting'}
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Write MOM & Take Attendance Modal */}
      {showMomModal && selectedMeeting && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <div>
                <h2 className="text-xl font-display font-bold text-surface-100 flex items-center gap-2">
                  <IconDoc className="w-6 h-6 text-emerald-400" /> Minutes of Meeting (MOM) &amp; Attendance
                </h2>
                <p className="text-xs text-surface-400 mt-1">{selectedMeeting.title}</p>
              </div>
              <button onClick={() => setShowMomModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMomSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  📝 Minutes of Meeting (MOM) Notes *
                </label>
                <textarea
                  required value={momText}
                  onChange={(e) => setMomText(e.target.value)}
                  className="input-field h-36 resize-none py-2.5 text-sm leading-relaxed"
                  placeholder="Write detailed meeting minutes, decisions made, action items, and key takeaways..."
                />
              </div>

              <div className="border-t border-surface-700/50 pt-4">
                <label className="block text-sm font-bold text-emerald-400 mb-2">
                  ✅ Participant Attendance Marking
                </label>
                <p className="text-xs text-surface-400 mb-3">Mark whether each invited participant was Present or Absent in this meeting:</p>

                <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-surface-900/60 rounded-xl border border-surface-700/50">
                  {(
                    (selectedMeeting.manualInvitedEmployees && selectedMeeting.manualInvitedEmployees.length > 0
                      ? selectedMeeting.manualInvitedEmployees
                      : selectedMeeting.invitedEmployees) || []
                  ).map((empItem) => {
                    const empObj = getEmployeeObject(empItem, employees);
                    const empId = empObj._id?.toString() || (typeof empItem === 'string' ? empItem : empItem._id);

                    const status = attendanceState[empId] || 'Present';
                    return (
                      <div key={empId} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/80 border border-surface-700/40">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={empObj} size="sm" />
                          <div>
                            <span className="text-xs font-bold text-surface-200 block">{empObj.name || 'Employee'}</span>
                            <span className="text-[10px] text-surface-400">{empObj.designation || empObj.role || ''}</span>
                          </div>
                        </div>


                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAttendanceState({ ...attendanceState, [empId]: 'Present' })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                              status === 'Present'
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                                : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                            }`}
                          >
                            <IconCheck className="w-3.5 h-3.5" /> Present
                          </button>

                          <button
                            type="button"
                            onClick={() => setAttendanceState({ ...attendanceState, [empId]: 'Absent' })}
                            className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                              status === 'Absent'
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                                : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                            }`}
                          >
                            <IconCross className="w-3.5 h-3.5" /> Absent
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button type="submit" disabled={submittingMom} className="btn-primary flex-1 py-2.5 text-sm">
                  {submittingMom ? 'Publishing...' : '🚀 Publish MOM & Send Attendance'}
                </button>
                <button type="button" onClick={() => setShowMomModal(false)} className="btn-secondary py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Published MOM Modal */}
      {showViewMomModal && selectedMeeting && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <div>
                <h2 className="text-xl font-display font-bold text-surface-100 flex items-center gap-2">
                  <IconDoc className="w-6 h-6 text-violet-400" /> Published Minutes of Meeting (MOM)
                </h2>
                <p className="text-xs text-surface-400 mt-1">{selectedMeeting.title}</p>
              </div>
              <button onClick={() => setShowViewMomModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-surface-800/80 p-5 rounded-2xl border border-surface-700/50 space-y-2">
                <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider">Minutes of Meeting Summary:</h4>
                <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">
                  {selectedMeeting.momText}
                </p>
                {selectedMeeting.momSubmittedAt && (
                  <p className="text-[10px] text-surface-500 pt-2 border-t border-surface-700/40">
                    Published on {new Date(selectedMeeting.momSubmittedAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-surface-200">Participant Attendance Breakdown:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(selectedMeeting.attendance || []).map((att) => {
                    const empObj = getEmployeeObject(att.employeeId, employees);
                    const isPresent = att.status === 'Present';
                    return (
                      <div key={empObj._id || Math.random()} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-900/60 border border-surface-700/40">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={empObj} size="xs" />
                          <span className="text-xs font-medium text-surface-200">{empObj.name || 'Employee'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPresent ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {att.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 text-right">
                <button onClick={() => setShowViewMomModal(false)} className="btn-secondary text-xs py-2 px-5">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View Invited Participants List Modal ────────────────────────────── */}
      {showParticipantsModal && selectedMeeting && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-700/50">
              <div>
                <h2 className="text-lg font-display font-bold text-surface-100 flex items-center gap-2">
                  <IconGroup className="w-5 h-5 text-violet-400" /> Invited Participants ({selectedMeeting.invitedEmployees?.length || 0})
                </h2>
                <p className="text-xs text-surface-400 mt-0.5">{selectedMeeting.title}</p>
              </div>
              <button onClick={() => setShowParticipantsModal(false)} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {(selectedMeeting.invitedEmployees || []).map((empItem) => {
                const empObj = getEmployeeObject(empItem, employees);
                return (
                  <div key={empObj._id || Math.random()} className="flex items-center justify-between p-3 rounded-xl bg-surface-800/80 border border-surface-700/40 hover:border-surface-600/50 transition-all">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={empObj} size="sm" />
                      <div>
                        <span className="text-xs font-bold text-surface-100 block">{empObj.name || 'Employee'}</span>
                        <span className="text-[11px] text-surface-400">{empObj.designation || empObj.role || ''} • {empObj.department || 'N/A'}</span>
                      </div>
                    </div>
                    {empObj.employeeCode && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                        {empObj.employeeCode}
                      </span>
                    )}
                  </div>
                );
              })}

            </div>

            <div className="p-4 border-t border-surface-700/50 text-right">
              <button onClick={() => setShowParticipantsModal(false)} className="btn-secondary text-xs py-2 px-5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request Rejoin Modal ────────────────────────────────────────────── */}

      {showRejoinModal && selectedMeeting && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-700/50">
              <h2 className="text-lg font-display font-bold text-surface-100 flex items-center gap-2">
                🔄 Request Rejoin Call
              </h2>
              <button onClick={() => setShowRejoinModal(false)} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400">
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejoinSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">
                  Reason for Leaving / Disconnection *
                </label>
                <textarea
                  required
                  value={rejoinReason}
                  onChange={(e) => setRejoinReason(e.target.value)}
                  className="input-field h-24 resize-none py-2 text-xs leading-relaxed"
                  placeholder="e.g. Network disconnected / Laptop restarted by mistake..."
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="submit" disabled={submittingRejoin} className="btn-primary flex-1 py-2 text-xs">
                  {submittingRejoin ? 'Sending Request...' : '📩 Submit Rejoin Request'}
                </button>
                <button type="button" onClick={() => setShowRejoinModal(false)} className="btn-secondary py-2 text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingsPage;



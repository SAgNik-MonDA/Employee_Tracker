import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  HiOutlineVideoCamera,
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineExternalLink,
  HiOutlineCheckCircle,
  HiOutlineDocumentText,
  HiOutlineX,
} from 'react-icons/hi';


const MANAGEMENT_KEYWORDS = [
  'technical lead', 'team lead', 'project manager', 'program manager',
  'delivery manager', 'operations manager', 'business analyst',
  'account manager', 'executive assistant', 'hr', 'hr executive', 'hr manager',
  'director', 'director of technology', 'vice president', 'vp',
  'chief technology officer', 'cto', 'chief executive officer', 'ceo',
  'chief operating officer', 'coo', 'chief information officer', 'cio',
  'managing director', 'admin', 'ciso', 'cfo', 'cmo'
];

const isManagementUser = (user) => {
  if (!user) return false;
  if (['Admin', 'HR', 'CEO', 'CTO', 'COO', 'CIO', 'CISO', 'Chief Financial Officer (CFO)'].includes(user.role)) return true;
  const role = (user.role || '').toLowerCase();
  const desig = (user.designation || '').toLowerCase();
  return MANAGEMENT_KEYWORDS.some((kw) => role.includes(kw) || desig.includes(kw));
};

const MeetingStatsCard = ({ userId, targetUser }) => {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [userMeetings, setUserMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMomModal, setShowMomModal] = useState(false);
  const [selectedMomMeeting, setSelectedMomMeeting] = useState(null);


  const evalUser = targetUser || (userId && userId !== currentUser?._id ? null : currentUser);
  const isMgmt = evalUser ? isManagementUser(evalUser) : isManagementUser(currentUser);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      if (isMgmt) {
        // Management user — fetch ONLY meetings where they were marked Present
        const { data } = await API.get('/meetings');
        const targetUserId = userId || currentUser?._id;

        const attendedMeetings = (data || []).filter((m) => {
          const attRecord = (m.attendance || []).find((a) => {
            const empId = a.employeeId?._id || a.employeeId;
            return empId?.toString() === targetUserId?.toString();
          });

          // Strictly show ONLY meetings where attendance status is 'Present'
          return attRecord && attRecord.status === 'Present';
        });

        setUserMeetings(attendedMeetings);
      } else {
        // Regular employee — fetch attendance summary stats
        const endpoint = userId ? `/meetings/stats/${userId}` : '/meetings/my-stats';
        const { data } = await API.get(endpoint);
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load meeting data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse space-y-3">
        <div className="w-32 h-5 bg-surface-700 rounded" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 bg-surface-700 rounded-xl" />
          <div className="h-16 bg-surface-700 rounded-xl" />
          <div className="h-16 bg-surface-700 rounded-xl" />
        </div>
      </div>
    );
  }

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

  const handleJoinCall = async (meeting) => {
    try {
      const { data } = await API.post(`/meetings/${meeting._id}/join`);
      fetchData();
      if (data.meetingLink) {
        const link = data.meetingLink.startsWith('http') ? data.meetingLink : `https://${data.meetingLink}`;
        window.open(link, '_blank');
      }
    } catch (err) {
      console.error('Join call error:', err);
    }
  };

  // Render for Management / Privileged roles: Meetings Attended Only
  if (isMgmt) {
    return (
      <div className="glass-card p-5 space-y-4 border border-surface-700/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-200 flex items-center gap-2 uppercase tracking-wider">
            <HiOutlineVideoCamera className="w-5 h-5 text-primary-400" /> Meetings Attended ({userMeetings.length})
          </h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Attended Only
          </span>
        </div>

        {userMeetings.length === 0 ? (
          <div className="text-center py-6 text-surface-500 text-xs font-medium">
            No meetings joined yet
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {userMeetings.map((m) => {
              const userIdStr = (userId || currentUser?._id)?.toString();
              const endDateTime = parseMeetingDateTime(m.date, m.endTime);
              const now = new Date();
              const isMeetingEnded = now > endDateTime;
              const hasJoined = (m.joinedUsers || []).some(
                (j) => (j.userId?._id || j.userId)?.toString() === userIdStr
              );

              return (
                <div key={m._id} className="p-3.5 rounded-xl bg-surface-800/60 border border-surface-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-surface-100 block">{m.title}</span>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-surface-400">
                      <span className="flex items-center gap-1">
                        <HiOutlineCalendar className="w-3.5 h-3.5 text-primary-400" />
                        {new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <HiOutlineClock className="w-3.5 h-3.5 text-amber-400" />
                        {m.startTime} – {m.endTime}
                      </span>
                      <span className="text-surface-500">By {m.createdBy?.name || 'Manager'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {m.isMomPublished && (
                      <button
                        type="button"
                        onClick={() => { setSelectedMomMeeting(m); setShowMomModal(true); }}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <HiOutlineDocumentText className="w-3.5 h-3.5" /> View MOM
                      </button>
                    )}

                    {isMeetingEnded ? (
                      <button disabled className="px-3 py-1.5 rounded-lg bg-surface-800 text-surface-500 border border-surface-700/50 text-xs font-semibold cursor-not-allowed">
                        ⏳ Meeting Ended
                      </button>
                    ) : hasJoined ? (
                      <button disabled className="px-3 py-1.5 rounded-lg bg-surface-800 text-surface-400 border border-surface-700/50 text-xs font-semibold cursor-not-allowed">
                        ✓ Joined
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinCall(m)}
                        className="px-3 py-1.5 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 border border-primary-500/30 text-xs font-semibold flex items-center gap-1.5 w-fit transition-all cursor-pointer"
                      >
                        <HiOutlineExternalLink className="w-3.5 h-3.5" /> Join Call
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── View Published MOM Modal ────────────────────────────── */}
        {showMomModal && selectedMomMeeting && (
          <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-surface-700/50">
                <div>
                  <h2 className="text-lg font-display font-bold text-surface-100 flex items-center gap-2">
                    <HiOutlineDocumentText className="w-5 h-5 text-violet-400" /> Published Minutes of Meeting (MOM)
                  </h2>
                  <p className="text-xs text-surface-400 mt-0.5">{selectedMomMeeting.title}</p>
                </div>
                <button onClick={() => setShowMomModal(false)} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400">
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="bg-surface-800/80 p-4 rounded-xl border border-surface-700/50 space-y-1.5">
                  <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider">Minutes Summary:</h4>
                  <p className="text-xs text-surface-200 whitespace-pre-wrap leading-relaxed">
                    {selectedMomMeeting.momText}
                  </p>
                  {selectedMomMeeting.momSubmittedAt && (
                    <p className="text-[10px] text-surface-500 pt-2 border-t border-surface-700/40">
                      Published on {new Date(selectedMomMeeting.momSubmittedAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-surface-200 uppercase tracking-wider">Attendance Breakdown:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(selectedMomMeeting.attendance || []).map((att) => {
                      const emp = att.employeeId;
                      if (!emp) return null;
                      const isPresent = att.status === 'Present';
                      return (
                        <div key={emp._id || emp} className="flex items-center justify-between p-2 rounded-xl bg-surface-900/60 border border-surface-700/40 text-xs">
                          <span className="font-medium text-surface-200">{emp.name}</span>
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
                  <button onClick={() => setShowMomModal(false)} className="btn-secondary text-xs py-1.5 px-4">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }



  // Render for Regular Employees: Attendance Summary Stats
  if (!stats) return null;

  return (
    <div className="glass-card p-5 space-y-4 border border-surface-700/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-300 flex items-center gap-2 uppercase tracking-wider">
          📹 Meeting Attendance &amp; MOM Summary
        </h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
          stats.attendanceRate >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          stats.attendanceRate >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
          'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {stats.attendanceRate}% Attendance Rate
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Total Invited */}
        <div className="bg-surface-800/60 p-3.5 rounded-xl border border-surface-700/40 text-center">
          <span className="text-xs text-surface-400 font-medium block mb-1">Invited</span>
          <span className="text-xl font-display font-bold text-surface-100">{stats.totalInvited}</span>
        </div>

        {/* Attended (Present) */}
        <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 text-center">
          <span className="text-xs text-emerald-300/80 font-medium block mb-1">Present</span>
          <span className="text-xl font-display font-bold text-emerald-400">{stats.totalPresent}</span>
        </div>

        {/* Missed (Absent) */}
        <div className="bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20 text-center">
          <span className="text-xs text-rose-300/80 font-medium block mb-1">Absent</span>
          <span className="text-xl font-display font-bold text-rose-400">{stats.totalAbsent}</span>
        </div>
      </div>
    </div>
  );
};

export default MeetingStatsCard;


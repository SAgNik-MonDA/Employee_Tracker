import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  HiOutlineUsers, HiOutlinePlus, HiOutlineX, HiOutlineSearch,
  HiOutlineTrash, HiOutlineDocumentText, HiOutlineUpload, HiOutlinePencil,
  HiOutlineClock, HiOutlineCalendar, HiOutlineCheckCircle,
  HiOutlineChatAlt2, HiOutlineClipboardList, HiOutlineRefresh,
  HiOutlineExclamationCircle, HiOutlineBadgeCheck,
  HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineArchive, HiOutlineCollection
} from 'react-icons/hi';

const BACKEND_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'https://employee-tracker-backend-6t0z.onrender.com';

const TEAM_CREATOR_DESIGNATIONS = [
  'technical lead', 'team lead', 'project manager', 'program manager',
  'operations manager', 'director of technology',
  'chief technology officer (cto)', 'cto',
];
const canManage = (user) => {
  if (!user) return false;
  if (['Admin', 'HR'].includes(user.role)) return true;
  const d = (user.designation || user.role || '').toLowerCase();
  return TEAM_CREATOR_DESIGNATIONS.some((x) => d.includes(x));
};
const canScheduleShifts = (user, team) => {
  if (!user || !team) return false;
  const d = (user.designation || user.role || '').toLowerCase();
  const isTL = d.includes('team lead');
  const isPM = d.includes('project manager') || d.includes('program manager');
  const isCreator = team.createdBy?._id === user._id || team.createdBy === user._id;
  return isTL || isPM || isCreator || ['Admin','HR'].includes(user.role);
};
const canViewAttendance = (user, team) => {
  if (!user || !team) return false;
  if (['Admin', 'HR'].includes(user.role)) return true;
  const d = (user.designation || user.role || '').toLowerCase();
  const isTL = d.includes('team lead');
  const isPM = d.includes('project manager') || d.includes('program manager');
  const isLead = (team.teamLead?._id || team.teamLead) === user._id;
  const isCreator = (team.createdBy?._id || team.createdBy) === user._id;
  return isTL || isPM || isLead || isCreator;
};

const SHIFT_INFO = {
  General: { label: 'General Shift', time: '10:00 AM – 6:00 PM', color: 'text-primary-400', bg: 'bg-primary-500/10 border-primary-500/20' },
  Morning: { label: 'Morning Shift', time: '6:00 AM – 2:00 PM', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  Evening: { label: 'Evening Shift', time: '2:00 PM – 10:00 PM', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  Night:   { label: 'Night Shift',   time: '10:00 PM – 6:00 AM', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
};

const StatusBadge = ({ status }) => {
  const map = {
    'Active':     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'Completed':  'bg-blue-500/15 text-blue-400 border-blue-500/25',
    'On Hold':    'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'Pending':    'bg-surface-500/15 text-surface-400 border-surface-500/25',
    'PM Approved':'bg-teal-500/15 text-teal-400 border-teal-500/25',
    'DM Approved':'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'Rejected':   'bg-rose-500/15 text-rose-400 border-rose-500/25',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${map[status] || 'bg-surface-700 text-surface-300 border-surface-600'}`}>{status}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const TeamsPage = () => {
  const { user } = useAuth();
  const { setActiveChatTeamId } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = sessionStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [teams, setTeams]               = useState([]);
  const [historyTeams, setHistoryTeams] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [employees, setEmployees]       = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedHistoryTeam, setSelectedHistoryTeam] = useState(null);
  const [activeTab, setActiveTab]       = useState('overview');
  const [showCreate, setShowCreate]     = useState(false);
  const [viewMode, setViewMode]         = useState('active'); // 'active' | 'history'
  const [extendHighlight, setExtendHighlight] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [historyMonthFilter, setHistoryMonthFilter] = useState('all');
  const [historySearch, setHistorySearch]           = useState('');
  const [historyToDelete, setHistoryToDelete]       = useState(null);
  const [deletingHistory, setDeletingHistory]       = useState(false);

  const handleConfirmDeleteHistory = async () => {
    if (!historyToDelete) return;
    setDeletingHistory(true);
    try {
      await API.delete(`/teams/history/${historyToDelete._id}`, { headers });
      toast.success(`Archived team "${historyToDelete.projectName}" deleted permanently`);
      fetchHistoryTeams();
      setHistoryToDelete(null);
      if (selectedHistoryTeam?._id === historyToDelete._id) {
        setSelectedHistoryTeam(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingHistory(false);
    }
  };

  // ── Sync Active Chat State with Global Notifications ─────────────────
  useEffect(() => {
    if (selectedTeam && activeTab === 'chat') {
      setActiveChatTeamId(selectedTeam._id);
    } else {
      setActiveChatTeamId(null);
    }
    return () => setActiveChatTeamId(null);
  }, [selectedTeam, activeTab, setActiveChatTeamId]);

  // ── Handle Auto-Open Chat from Notifications ────────────────────────
  useEffect(() => {
    const openChatTeamId = searchParams.get('openChat');
    if (openChatTeamId && teams.length > 0) {
      const teamToOpen = teams.find(t => t._id === openChatTeamId);
      if (teamToOpen) {
        setSelectedTeam(teamToOpen);
        setActiveTab('chat');
        // Clear param so a refresh doesn't re-trigger it
        setSearchParams(new URLSearchParams());
      }
    }
  }, [searchParams, teams, setSearchParams]);

  const isAuthoritative = useMemo(() => {
    if (!user) return false;
    if (['Admin', 'HR'].includes(user.role)) return true;
    const des = (user.designation || user.role || '').toLowerCase();
    return des.includes('project manager') || des.includes('program manager') || des.includes('operations manager');
  }, [user]);

  const availableMonths = useMemo(() => {
    const monthsMap = new Map();
    [...historyTeams, ...teams].forEach(t => {
      const date = t.completedAt || t.startDate || t.createdAt;
      if (date) {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          monthsMap.set(key, label);
        }
      }
    });
    return Array.from(monthsMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [historyTeams, teams]);

  const monthlyStats = useMemo(() => {
    let completedCount = 0;
    let createdCount = 0;
    let totalMembersEngaged = 0;
    let myCompletedCount = 0;

    const isUserInTeam = (t) => {
      if (!user?._id) return false;
      const uid = user._id.toString();
      const isMember = (t.members || []).some(m => (m._id || m)?.toString() === uid);
      const isLead = (t.teamLead?._id || t.teamLead)?.toString() === uid;
      const isCreator = (t.createdBy?._id || t.createdBy)?.toString() === uid;
      return isMember || isLead || isCreator;
    };

    historyTeams.forEach(item => {
      const date = item.completedAt || item.createdAt;
      if (date) {
        const d = new Date(date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (historyMonthFilter === 'all' || key === historyMonthFilter) {
          completedCount++;
          totalMembersEngaged += (item.members || []).length;
          if (isUserInTeam(item)) {
            myCompletedCount++;
          }
        }
      }
    });

    [...teams, ...historyTeams].forEach(item => {
      const date = item.startDate || item.createdAt;
      if (date) {
        const d = new Date(date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (historyMonthFilter === 'all' || key === historyMonthFilter) {
          createdCount++;
        }
      }
    });

    const myActiveCount = teams.filter(isUserInTeam).length;
    const myTotalCompleted = historyTeams.filter(isUserInTeam).length;
    const myTotalProjects = myActiveCount + myTotalCompleted;

    return {
      completedCount,
      createdCount,
      membersEngaged: totalMembersEngaged,
      myCompletedCount,
      myActiveCount,
      myTotalProjects,
    };
  }, [historyTeams, teams, historyMonthFilter, user]);

  const filteredHistoryTeams = useMemo(() => {
    return historyTeams.filter(item => {
      if (!isAuthoritative) {
        const uid = user?._id?.toString();
        const isMember = (item.members || []).some(m => (m._id || m)?.toString() === uid);
        const isLead = (item.teamLead?._id || item.teamLead)?.toString() === uid;
        const isCreator = (item.createdBy?._id || item.createdBy)?.toString() === uid;
        if (!isMember && !isLead && !isCreator) return false;
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchName = (item.projectName || '').toLowerCase().includes(q);
        const matchId   = (item.teamId || '').toLowerCase().includes(q);
        const matchTech = (item.techStack || []).some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchId && !matchTech) return false;
      }

      if (historyMonthFilter !== 'all') {
        const date = item.completedAt || item.createdAt;
        if (!date) return false;
        const d = new Date(date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (key !== historyMonthFilter) return false;
      }

      return true;
    });
  }, [historyTeams, historySearch, historyMonthFilter, isAuthoritative, user]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await API.get('/teams', { headers });
      setTeams(Array.isArray(data) ? data : []);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, []);

  const handleConfirmDeleteTeam = async () => {
    if (!teamToDelete) return;
    setDeletingTeam(true);
    try {
      await API.delete(`/teams/${teamToDelete._id}`, { headers });
      toast.success(`Team "${teamToDelete.projectName}" deleted successfully`);
      fetchTeams();
      fetchHistoryTeams();
      setTeamToDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingTeam(false);
    }
  };

  const fetchHistoryTeams = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await API.get('/teams/history/all', { headers });
      setHistoryTeams(Array.isArray(data) ? data : []);
    } catch(e){ console.error(e); }
    finally { setLoadingHistory(false); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await API.get('/auth/employees', { headers });
      setEmployees(Array.isArray(data) ? data : data.employees || []);
    } catch(e){ console.error(e); }
  }, []);

  useEffect(() => { 
    fetchTeams(); 
    fetchEmployees(); 
    fetchHistoryTeams();
  }, []);

  // Handle URL parameters for opening specific team or date extension
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('openTeam');
    const extend = params.get('extend') === 'true';
    const viewHist = params.get('viewHistory') === 'true';

    if (viewHist) {
      setViewMode('history');
    }

    if (openId) {
      API.get(`/teams/${openId}`, { headers })
        .then(({ data }) => {
          setSelectedTeam(data);
          setActiveTab('overview');
          if (extend) {
            setExtendHighlight(true);
          }
        })
        .catch(e => console.error(e));
    }
  }, []);

  const openTeam = async (team, shouldExtend = false) => {
    try {
      const { data } = await API.get(`/teams/${team._id}`, { headers });
      setSelectedTeam(data);
      setActiveTab('overview');
      setExtendHighlight(shouldExtend);
    } catch(e){ console.error(e); }
  };

  const closeTeam = () => { setSelectedTeam(null); setActiveTab('overview'); setExtendHighlight(false); };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-100 flex items-center gap-2.5">
            <HiOutlineUsers className="w-7 h-7 text-primary-400" /> Teams Portal
          </h1>
          <p className="text-surface-500 mt-1">Manage active teams, schedule shifts, track delivery & inspect completed team archives</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Active vs History Switcher */}
          <div className="flex bg-surface-800/80 p-1 rounded-xl border border-surface-700/50">
            <button
              onClick={() => setViewMode('active')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'active' 
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' 
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <HiOutlineUsers className="w-4 h-4" /> Active ({teams.length})
            </button>
            <button
              onClick={() => {
                setViewMode('history');
                fetchHistoryTeams();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'history' 
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' 
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <HiOutlineArchive className="w-4 h-4" /> Team History ({historyTeams.length})
            </button>
          </div>

          {canManage(user) && viewMode === 'active' && (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5">
              <HiOutlinePlus className="w-4 h-4" /> Create Team
            </button>
          )}
        </div>
      </div>

      {/* Content based on View Mode */}
      {viewMode === 'active' ? (
        loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <HiOutlineUsers className="w-16 h-16 text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-300 mb-2">No Active Teams</h3>
            <p className="text-surface-500 text-sm">
              {canManage(user) ? 'Create your first team to get started.' : 'You haven\'t been added to any active team yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {teams.map((team) => (
              <TeamCard key={team._id} team={team} user={user} onOpen={openTeam} onRequestDelete={setTeamToDelete} headers={headers} />
            ))}
          </div>
        )
      ) : (
        /* Team History View */
        <div className="space-y-5">
          {/* Monthly Track Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {isAuthoritative ? (
              <>
                <div className="glass-card p-4 flex items-center justify-between border-l-4 border-purple-500">
                  <div>
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Teams Completed</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{monthlyStats.completedCount}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      {historyMonthFilter === 'all' ? 'Total completed archives' : 'Completed in selected month'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <HiOutlineBadgeCheck className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center justify-between border-l-4 border-emerald-500">
                  <div>
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Teams Created</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{monthlyStats.createdCount}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      {historyMonthFilter === 'all' ? 'Total projects launched' : 'Created in selected month'}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <HiOutlineCalendar className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center justify-between border-l-4 border-amber-500">
                  <div>
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Members Engaged</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{monthlyStats.membersEngaged}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      {historyMonthFilter === 'all' ? 'Across all archives' : 'Participated in archived projects'}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                    <HiOutlineUsers className="w-6 h-6" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="glass-card p-4 flex items-center justify-between border-l-4 border-purple-500">
                  <div>
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">My Completed Projects</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">{monthlyStats.myCompletedCount}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      {historyMonthFilter === 'all' ? 'Projects completed total' : 'Completed in selected month'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <HiOutlineBadgeCheck className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center justify-between border-l-4 border-emerald-500">
                  <div>
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">My Active Teams</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{monthlyStats.myActiveCount}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      Currently assigned active teams
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <HiOutlineUsers className="w-6 h-6" />
                  </div>
                </div>

                <div className="glass-card p-4 flex items-center justify-between border-l-4 border-blue-500">
                  <div>
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Total Projects</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">{monthlyStats.myTotalProjects}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      Total active & completed projects
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                    <HiOutlineCollection className="w-6 h-6" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 glass-card p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-surface-400 whitespace-nowrap">Filter Month:</span>
              <select
                className="input-field py-1.5 px-3 text-xs w-auto bg-surface-800 text-surface-200 cursor-pointer font-medium border-surface-700"
                value={historyMonthFilter}
                onChange={e => setHistoryMonthFilter(e.target.value)}
              >
                <option value="all">📅 All Months</option>
                {availableMonths.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-md">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input
                className="input-field pl-9 py-1.5 text-xs"
                placeholder="Search history by project name, ID, or tech..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                >
                  <HiOutlineX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* History Grid */}
          {loadingHistory ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredHistoryTeams.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <HiOutlineArchive className="w-16 h-16 text-surface-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-surface-300 mb-2">No Matching History Found</h3>
              <p className="text-surface-500 text-sm">Try selecting a different month or clearing your search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredHistoryTeams.map((item) => (
                <TeamHistoryCard
                  key={item._id}
                  item={item}
                  user={user}
                  onOpen={setSelectedHistoryTeam}
                  onRequestDelete={setHistoryToDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreate && (
        <CreateTeamModal employees={employees} headers={headers} onClose={() => setShowCreate(false)} onCreated={(t) => { setTeams(prev => [t, ...prev]); setShowCreate(false); }} />
      )}

      {/* Team Detail Drawer */}
      {selectedTeam && (
        <TeamDetailDrawer
          team={selectedTeam}
          setTeam={setSelectedTeam}
          user={user}
          employees={employees}
          headers={headers}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={closeTeam}
          onRefresh={fetchTeams}
          isExtendHighlight={extendHighlight}
          onTeamUpdated={(updated) => {
            setSelectedTeam(updated);
            setTeams(prev => prev.map(t => t._id === updated._id ? { ...t, ...updated } : t));
          }}
        />
      )}

      {/* Team History Drawer */}
      {selectedHistoryTeam && (
        <TeamHistoryDrawer
          item={selectedHistoryTeam}
          user={user}
          onClose={() => setSelectedHistoryTeam(null)}
          onRequestDelete={setHistoryToDelete}
        />
      )}

      {/* Confirm Team Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(teamToDelete)}
        onClose={() => setTeamToDelete(null)}
        onConfirm={handleConfirmDeleteTeam}
        title="Delete Team"
        message="Are you sure you want to delete this team? All shift schedules and project documents associated with this team will be deleted."
        itemName={teamToDelete?.projectName}
        confirmText="Confirm Delete Team"
        loading={deletingTeam}
      />

      {/* Confirm Team History Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(historyToDelete)}
        onClose={() => setHistoryToDelete(null)}
        onConfirm={handleConfirmDeleteHistory}
        title="Delete Archived Record"
        message="Are you sure you want to permanently delete this team history record from the archives? This action cannot be undone."
        itemName={historyToDelete?.projectName}
        confirmText="Confirm Delete Archive"
        loading={deletingHistory}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM CARD
// ═══════════════════════════════════════════════════════════════════════════════
const TeamCard = ({ team, user, onOpen, onRequestDelete, headers }) => {
  const isCreator = team.createdBy?._id === user?._id || team.createdBy === user?._id;
  const isAdmin   = ['Admin','HR'].includes(user?.role);

  const handleDelete = (e) => {
    e.stopPropagation();
    onRequestDelete(team);
  };

  const daysLeft = team.endDate ? Math.ceil((new Date(team.endDate) - new Date()) / 86400000) : null;

  return (
    <div onClick={() => onOpen(team)} className="glass-card p-5 cursor-pointer hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-primary-400 font-bold">{team.teamId}</span>
          <h3 className="text-base font-bold text-surface-100 mt-0.5 group-hover:text-primary-300 transition-colors">{team.projectName}</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={team.status} />
          {(isCreator || isAdmin) && (
            <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-surface-500 hover:text-rose-400 transition-colors">
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Members avatars */}
      <div className="flex items-center gap-1.5 mb-3">
        {(team.members || []).slice(0, 5).map((m, i) => (
          <div key={m._id || i} style={{ zIndex: 5 - i }} className="-ml-1 first:ml-0 ring-2 ring-surface-900 rounded-full">
            <UserAvatar user={m} size="xs" />
          </div>
        ))}
        {team.members?.length > 5 && <span className="text-xs text-surface-500 ml-1">+{team.members.length - 5}</span>}
        <span className="ml-auto text-xs text-surface-500">{team.members?.length || 0} members</span>
      </div>

      {/* Tech Stack */}
      {team.techStack?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {team.techStack.slice(0, 4).map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">{t}</span>
          ))}
          {team.techStack.length > 4 && <span className="px-2 py-0.5 rounded-md text-[10px] text-surface-500">+{team.techStack.length - 4}</span>}
        </div>
      )}

      {/* Duration */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-700/40">
        <div className="flex items-center gap-1.5 text-xs text-surface-500">
          <HiOutlineCalendar className="w-3.5 h-3.5" />
          {team.startDate ? new Date(team.startDate).toLocaleDateString('en-IN', {day:'numeric',month:'short'}) : '—'}
          <span>→</span>
          {team.endDate ? new Date(team.endDate).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : '—'}
        </div>
        {daysLeft !== null && (
          <span className={`text-xs font-bold ${daysLeft < 0 ? 'text-rose-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </span>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE TEAM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const CreateTeamModal = ({ employees, headers, onClose, onCreated }) => {
  const [form, setForm] = useState({
    projectName: '', members: [], teamLead: '', startDate: '', endDate: '',
    techStack: '', status: 'Active',
  });
  const [empSearch, setEmpSearch]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.designation||'').toLowerCase().includes(empSearch.toLowerCase())
  );
  const selectedMembers = form.members.map(id => employees.find(e => e._id === id)).filter(Boolean);

  const toggleMember = (id) => {
    setForm(p => ({ ...p,
      members: p.members.includes(id) ? p.members.filter(x => x !== id) : [...p.members, id],
      teamLead: p.teamLead === id ? '' : p.teamLead,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectName.trim()) return alert('Project name required');
    setSubmitting(true);
    try {
      const { data } = await API.post('/teams', {
        ...form,
        techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean),
        teamLead: form.teamLead || undefined,
      }, { headers });
      onCreated(data);
    } catch(err) { alert(err.response?.data?.message || 'Create failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-surface-700/50 sticky top-0 bg-surface-900/90 backdrop-blur z-10">
          <h2 className="text-lg font-display font-bold text-surface-100 flex items-center gap-2">
            <HiOutlinePlus className="w-5 h-5 text-primary-400" /> Create New Team
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400"><HiOutlineX className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-surface-300 mb-1.5">Project Name *</label>
              <input required className="input-field" placeholder="e.g. Customer Portal v2" value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1.5">Start Date</label>
              <input type="date" className="input-field" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1.5">End Date</label>
              <input type="date" className="input-field" value={form.endDate} onChange={e => setForm(p => ({...p, endDate: e.target.value}))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-surface-300 mb-1.5">Tech Stack (comma-separated)</label>
              <input className="input-field" placeholder="e.g. React, Node.js, MongoDB, AWS" value={form.techStack} onChange={e => setForm(p => ({...p, techStack: e.target.value}))} />
            </div>
          </div>

          {/* Employee Search */}
          <div>
            <label className="block text-xs font-bold text-surface-300 mb-1.5">Add Members ({form.members.length} selected)</label>
            <div className="relative mb-2">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input className="input-field pl-9" placeholder="Search employees..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border border-surface-700/50 rounded-xl p-2">
              {filtered.map(emp => (
                <label key={emp._id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${form.members.includes(emp._id) ? 'bg-primary-500/10 border border-primary-500/20' : 'hover:bg-surface-800/50 border border-transparent'}`}>
                  <input type="checkbox" className="accent-primary-500" checked={form.members.includes(emp._id)} onChange={() => toggleMember(emp._id)} />
                  <UserAvatar user={emp} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-surface-200 truncate">
                      {emp.name} {emp.employeeCode ? <span className="font-mono text-[10px] text-surface-400">({emp.employeeCode})</span> : ''}
                    </p>
                    <p className="text-[10px] text-surface-500 truncate">{emp.designation || emp.role}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Team Lead from selected members */}
          {form.members.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1.5">Team Lead (from members)</label>
              <select className="input-field" value={form.teamLead} onChange={e => setForm(p => ({...p, teamLead: e.target.value}))}>
                <option value="">— Select Team Lead —</option>
                {selectedMembers.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.name} {m.employeeCode ? `(${m.employeeCode})` : ''} · {m.designation || m.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5">
              {submitting ? 'Creating...' : '✨ Create Team'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary py-2.5 px-6">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM DETAIL DRAWER (Full-screen overlay with tabs)
// ═══════════════════════════════════════════════════════════════════════════════
const TeamDetailDrawer = ({ team, setTeam, user, employees, headers, activeTab, setActiveTab, onClose, onRefresh, onTeamUpdated, isExtendHighlight }) => {
  const TABS = [
    { id: 'overview',   label: 'Overview',       icon: <HiOutlineUsers className="w-4 h-4" /> },
    { id: 'progress',   label: 'Progress',        icon: <HiOutlineCheckCircle className="w-4 h-4" /> },
    { id: 'shifts',     label: 'Shifts',          icon: <HiOutlineClock className="w-4 h-4" /> },
    { id: 'chat',       label: 'Team Chat',       icon: <HiOutlineChatAlt2 className="w-4 h-4" /> },
    { id: 'attendance', label: 'Attendance',      icon: <HiOutlineClipboardList className="w-4 h-4" /> },
    { id: 'docs',       label: 'Documents',       icon: <HiOutlineDocumentText className="w-4 h-4" /> },
  ];

  const updateStatus = async (newStatus) => {
    const prevStatus = team.status;
    setTeam(prev => ({ ...prev, status: newStatus }));
    try {
      const { data } = await API.put(`/teams/${team._id}`, { status: newStatus }, { headers });
      setTeam(data);
      if (onTeamUpdated) onTeamUpdated(data);
      if (onRefresh) onRefresh();
    } catch (err) {
      setTeam(prev => ({ ...prev, status: prevStatus }));
      alert(err.response?.data?.message || 'Error updating status');
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-950/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="glass-card w-full max-w-5xl min-h-[85vh] animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-surface-700/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-primary-400">{team.teamId}</span>
              <StatusBadge status={team.status} />
            </div>
            <h2 className="text-xl font-display font-bold text-surface-100">{team.projectName}</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Created by {team.createdBy?.name || 'Admin'}{team.createdBy?.employeeCode ? ` (${team.createdBy.employeeCode})` : ''} ·{' '}
              {team.startDate ? new Date(team.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
              {' → '}
              {team.endDate ? new Date(team.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 transition-colors"><HiOutlineRefresh className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 transition-colors"><HiOutlineX className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-3 border-b border-surface-700/40 overflow-x-auto">
          {TABS.filter(t => {
            if (t.id === 'attendance' && !canViewAttendance(user, team)) return false;
            return true;
          }).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border border-transparent'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-5 overflow-y-auto">
          {activeTab === 'overview'   && <OverviewTab   team={team} setTeam={setTeam} user={user} employees={employees} headers={headers} updateStatus={updateStatus} isExtendHighlight={isExtendHighlight} />}
          {activeTab === 'progress'   && <ProgressTab   team={team} setTeam={setTeam} user={user} headers={headers} />}
          {activeTab === 'shifts'     && <ShiftsTab     team={team} setTeam={setTeam} user={user} headers={headers} />}
          {activeTab === 'chat'       && <ChatTab       team={team} user={user} headers={headers} />}
          {activeTab === 'attendance' && <AttendanceTab team={team} user={user} headers={headers} />}
          {activeTab === 'docs'       && <DocsTab       team={team} setTeam={setTeam} user={user} headers={headers} />}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
const OverviewTab = ({ team, setTeam, user, employees, headers, updateStatus, isExtendHighlight }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    projectName: team.projectName, startDate: team.startDate?.split('T')[0] || '',
    endDate: team.endDate?.split('T')[0] || '', techStack: (team.techStack||[]).join(', '),
    status: team.status, members: (team.members||[]).map(m => m._id), teamLead: team.teamLead?._id || '',
  });
  const [empSearch, setEmpSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const endDateRef = useRef(null);

  useEffect(() => {
    if (isExtendHighlight) {
      setEditing(true);
      setTimeout(() => {
        if (endDateRef.current) {
          endDateRef.current.focus();
          endDateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [isExtendHighlight]);

  useEffect(() => {
    setForm(p => ({
      ...p,
      projectName: team.projectName || '',
      startDate: team.startDate?.split('T')[0] || '',
      endDate: team.endDate?.split('T')[0] || '',
      techStack: (team.techStack||[]).join(', '),
      status: team.status || 'Active',
      members: (team.members||[]).map(m => m._id || m),
      teamLead: team.teamLead?._id || team.teamLead || '',
    }));
  }, [team]);

  const isCreator = team.createdBy?._id === user?._id || team.createdBy === user?._id;
  const isAdmin   = ['Admin','HR'].includes(user?.role);
  const isLead    = (team.teamLead?._id || team.teamLead) === user?._id;
  const canEdit   = isCreator || isAdmin || isLead || canManage(user);

  const des = (user?.designation || user?.role || '').toLowerCase();
  const canExtendEndDate = ['Admin', 'HR'].includes(user?.role) || 
    des.includes('project manager') || des.includes('program manager') || des.includes('operations manager');

  const handleStatusChange = async (newStatus) => {
    if (updateStatus) {
      return updateStatus(newStatus);
    }
    const prevStatus = team.status;
    setTeam(prev => ({ ...prev, status: newStatus }));
    try {
      const { data } = await API.put(`/teams/${team._id}`, { status: newStatus }, { headers });
      setTeam(data);
    } catch (err) {
      setTeam(prev => ({ ...prev, status: prevStatus }));
      toast.error(err.response?.data?.message || 'Error updating status');
    }
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.designation||'').toLowerCase().includes(empSearch.toLowerCase())
  );
  const selectedMembers = form.members.map(id => employees.find(e => e._id === id)).filter(Boolean);

  const toggleMember = (id) => setForm(p => ({...p,
    members: p.members.includes(id) ? p.members.filter(x => x !== id) : [...p.members, id],
    teamLead: p.teamLead === id ? '' : p.teamLead,
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await API.put(`/teams/${team._id}`, {
        ...form,
        status: team.status,
        techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean),
        teamLead: form.teamLead || undefined,
      }, { headers });
      setTeam(data); 
      setEditing(false);
      toast.success('Team details updated & End Date extended successfully! 🎉');
    } catch(e){ toast.error(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      {canEdit && (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2 px-5">{saving ? 'Saving...' : 'Save Changes'}</button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm py-2 px-5">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm py-2 px-5 flex items-center gap-1.5"><HiOutlinePencil className="w-4 h-4" /> Edit Team</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {editing ? (
            <div className="glass-card p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">Project Name</label>
                <input className="input-field" value={form.projectName} onChange={e => setForm(p => ({...p, projectName: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1.5">Start Date</label>
                  <input type="date" className="input-field" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))} />
                </div>
                <div className={`p-2.5 rounded-xl transition-all ${isExtendHighlight ? 'bg-amber-500/10 border-2 border-amber-500/60 ring-4 ring-amber-500/20' : ''}`}>
                  {isExtendHighlight && (
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-1.5 animate-pulse">
                      <HiOutlineClock className="w-4 h-4" />
                      <span>⚠️ Extend End Date here to prevent auto-deletion!</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-surface-300">End Date</label>
                    {!canExtendEndDate && (
                      <span className="text-[10px] text-amber-400/80 font-medium">🔒 PM / Admin Only</span>
                    )}
                  </div>
                  <input
                    ref={endDateRef}
                    type="date"
                    disabled={!canExtendEndDate}
                    className={`input-field ${isExtendHighlight ? 'border-amber-500 text-amber-300 font-bold' : ''} ${!canExtendEndDate ? 'opacity-60 cursor-not-allowed' : ''}`}
                    value={form.endDate}
                    onChange={e => setForm(p => ({...p, endDate: e.target.value}))}
                    title={!canExtendEndDate ? 'Only Project Managers and Admins are authorized to extend or change the End Date' : ''}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">Tech Stack</label>
                <input className="input-field" placeholder="React, Node.js, ..." value={form.techStack} onChange={e => setForm(p => ({...p, techStack: e.target.value}))} />
              </div>

              {/* Members in edit mode */}
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">Members ({form.members.length})</label>
                <input className="input-field mb-2" placeholder="Search..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                <div className="max-h-40 overflow-y-auto space-y-1 border border-surface-700/50 rounded-xl p-2">
                  {filtered.map(emp => (
                    <label key={emp._id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${form.members.includes(emp._id) ? 'bg-primary-500/10' : 'hover:bg-surface-800/50'}`}>
                      <input type="checkbox" className="accent-primary-500" checked={form.members.includes(emp._id)} onChange={() => toggleMember(emp._id)} />
                      <UserAvatar user={emp} size="xs" />
                      <span className="text-xs text-surface-200">
                        {emp.name} {emp.employeeCode ? <span className="font-mono text-[10px] text-surface-400">({emp.employeeCode})</span> : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {form.members.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1.5">Team Lead</label>
                  <select className="input-field" value={form.teamLead} onChange={e => setForm(p => ({...p, teamLead: e.target.value}))}>
                    <option value="">— Select —</option>
                    {selectedMembers.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.name} {m.employeeCode ? `(${m.employeeCode})` : ''} · {m.designation || m.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          ) : (
            <>
              {/* Tech Stack */}
              {team.techStack?.length > 0 && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Tech Stack</h4>
                  <div className="flex flex-wrap gap-2">
                    {team.techStack.map((t, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg text-xs font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Members */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">{team.members?.length || 0} Team Members</h4>
                <div className="space-y-2.5">
                  {(team.members || []).map(m => (
                    <div key={m._id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-800/50 border border-surface-700/30">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar user={m} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-surface-200">
                            {m.name} {m.employeeCode && <span className="text-xs font-mono text-surface-400 ml-1">({m.employeeCode})</span>}
                          </p>
                          <p className="text-xs text-surface-500">{m.designation || m.role}</p>
                        </div>
                      </div>
                      {team.teamLead?._id === m._id && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Team Lead</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Stats */}
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Project Info</h4>
            <InfoRow label="Team ID"    value={team.teamId} />
            <InfoRow label="Members"    value={`${team.members?.length || 0} employees`} />
            <InfoRow label="Team Lead"  value={team.teamLead ? `${team.teamLead.name}${team.teamLead.employeeCode ? ` (${team.teamLead.employeeCode})` : ''}` : '—'} />
            <InfoRow label="Start"      value={team.startDate ? new Date(team.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'} />
            <InfoRow label="End"        value={team.endDate ? new Date(team.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'} />
            <InfoRow label="Documents"  value={`${team.documents?.length || 0} files`} />
            
            <div className="flex items-center justify-between py-1 border-b border-surface-700/30 last:border-0">
              <span className="text-xs text-surface-500">Status</span>
              {canEdit ? (
                <select 
                  className="input-field py-1 px-2 text-xs w-auto bg-surface-800 cursor-pointer font-medium" 
                  value={team.status || 'Active'} 
                  onChange={e => handleStatusChange(e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              ) : (
                <StatusBadge status={team.status} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1 border-b border-surface-700/30 last:border-0">
    <span className="text-xs text-surface-500">{label}</span>
    <span className="text-xs font-semibold text-surface-200">{value}</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PROGRESS & DELIVERY
// ═══════════════════════════════════════════════════════════════════════════════
const ProgressTab = ({ team, setTeam, user, headers }) => {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const des = (user?.designation || user?.role || '').toLowerCase();
  const isTL = des.includes('team lead');
  const isPM = des.includes('project manager') || des.includes('program manager');
  const isDM = des.includes('delivery manager') || des.includes('operations manager');
  const isAdmin = ['Admin','HR'].includes(user?.role);
  
  const isThisTeamLead = team.teamLead?._id === user?._id;
  const canApprovePM = !isThisTeamLead && (isPM || isAdmin);
  const canApproveDM = !isThisTeamLead && (isDM || isAdmin);

  const submit = async () => {
    if (!msg.trim()) return;
    setLoading(true);
    try {
      const { data } = await API.post(`/teams/${team._id}/progress`, { message: msg }, { headers });
      setTeam(p => ({ ...p, progressUpdates: [...(p.progressUpdates||[]), data] }));
      setMsg('');
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  const approve = async (updateId, action) => {
    try {
      const { data } = await API.put(`/teams/${team._id}/progress/${updateId}/approve`, { action }, { headers });
      setTeam(p => ({
        ...p,
        progressUpdates: (p.progressUpdates||[]).map(u => u._id === updateId ? { ...u, ...data } : u),
      }));
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  return (
    <div className="space-y-5">
      {/* Submit Update */}
      {isThisTeamLead && (
        <div className="glass-card p-4">
          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><HiOutlinePencil className="w-3.5 h-3.5" /> Submit Progress Update</h4>
          <textarea
            rows={3}
            className="input-field resize-none mb-3"
            placeholder="Describe the progress, completion, or delivery milestone..."
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <button onClick={submit} disabled={loading || !msg.trim()} className="btn-primary text-sm py-2 px-5">
            {loading ? 'Submitting...' : 'Submit to Project Manager'}
          </button>
        </div>
      )}

      {/* Updates List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Progress History</h4>
        {(team.progressUpdates || []).length === 0 && (
          <div className="text-center py-10 text-surface-500 text-sm">No progress updates yet.</div>
        )}
        {[...(team.progressUpdates || [])].reverse().map(u => (
          <div key={u._id} className="glass-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <UserAvatar user={u.submittedBy} size="xs" />
                <div>
                  <p className="text-xs font-bold text-surface-200">
                    {u.submittedBy?.name || 'Unknown'} {u.submittedBy?.employeeCode && <span className="font-mono text-surface-400 font-normal">({u.submittedBy.employeeCode})</span>}
                  </p>
                  <p className="text-[10px] text-surface-500">{new Date(u.submittedAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <StatusBadge status={u.status} />
            </div>
            <p className="text-sm text-surface-300 leading-relaxed pl-8">{u.message}</p>

            {/* Approval Chain Timeline (Only for Team Lead) */}
            {isThisTeamLead && (
              <div className="pl-8 flex items-center gap-2 text-xs">
                <span className={`flex items-center gap-1 ${u.pmApprovedBy ? 'text-teal-400' : 'text-surface-600'}`}>
                  {u.pmApprovedBy ? <HiOutlineCheckCircle className="w-3.5 h-3.5" /> : <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                  PM Review {u.pmApprovedBy ? `✓ ${u.pmApprovedBy?.name || ''}${u.pmApprovedBy?.employeeCode ? ` (${u.pmApprovedBy.employeeCode})` : ''}` : '(Pending)'}
                </span>
                <span className="text-surface-700">→</span>
                <span className={`flex items-center gap-1 ${u.dmApprovedBy ? 'text-emerald-400' : 'text-surface-600'}`}>
                  {u.dmApprovedBy ? <HiOutlineBadgeCheck className="w-3.5 h-3.5" /> : <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                  DM Approval {u.dmApprovedBy ? `✓ ${u.dmApprovedBy?.name || ''}${u.dmApprovedBy?.employeeCode ? ` (${u.dmApprovedBy.employeeCode})` : ''}` : '(Pending)'}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            {u.status === 'Pending' && canApprovePM && (
              <div className="pl-8 flex gap-2">
                <button onClick={() => approve(u._id, 'pm-approve')} className="btn-primary text-xs py-1.5 px-4">✓ PM Approve</button>
                <button onClick={() => approve(u._id, 'reject')} className="text-xs py-1.5 px-4 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">✕ Reject</button>
              </div>
            )}
            {u.status === 'PM Approved' && canApproveDM && (
              <div className="pl-8 flex gap-2">
                <button onClick={() => approve(u._id, 'dm-approve')} className="btn-primary text-xs py-1.5 px-4">✓ DM Approve</button>
                <button onClick={() => approve(u._id, 'reject')} className="text-xs py-1.5 px-4 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">✕ Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const formatDateKey = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && d.length === 10) return d;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ══════════════════════════════════════════════════════════════
// TAB: SHIFTS
// ══════════════════════════════════════════════════════════════
const ShiftsTab = ({ team, setTeam, user, headers }) => {
  const [form, setForm] = useState({ employeeId: '', shiftType: 'Morning', date: '' });
  const [adding, setAdding] = useState(false);
  const [isCurrentlyLocked, setIsCurrentlyLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(false);
  const canSchedule = canScheduleShifts(user, team);

  useEffect(() => {
    const checkLockStatus = async () => {
      if (!form.employeeId || !form.date) {
        setIsCurrentlyLocked(false);
        return;
      }

      // Check local team shifts first with formatDateKey
      const localMatch = (team.shifts || []).find(s => {
        const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
        return sEmp === form.employeeId.toString() && formatDateKey(s.date) === formatDateKey(form.date);
      });

      if (localMatch) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const shiftDate = new Date(localMatch.date);
        shiftDate.setHours(0, 0, 0, 0);
        const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);
        if (localMatch.isLocked || today >= lockThreshold) {
          setIsCurrentlyLocked(true);
          return;
        } else {
          setIsCurrentlyLocked(false);
          return;
        }
      }

      setCheckingLock(true);
      try {
        const { data } = await API.get(`/shifts/${form.employeeId}?startDate=${form.date}&endDate=${form.date}`, { headers });
        const lockedShifts = data.filter(s => s.isLocked);
        setIsCurrentlyLocked(data.length > 0 && lockedShifts.length > 0);
      } catch (error) {
        console.error('Error checking lock status', error);
      } finally {
        setCheckingLock(false);
      }
    };
    checkLockStatus();
  }, [form.employeeId, form.date, team.shifts]);

  const handleLockToggle = async () => {
    if (!form.employeeId || !form.date) return toast.error('Please select member and date first');
    try {
      if (isCurrentlyLocked) {
        const { data } = await API.put('/shifts/unlock', { employeeId: form.employeeId, dates: [form.date] }, { headers });
        toast.success(data.message || 'Shift schedule unlocked successfully! 🔓');
        setIsCurrentlyLocked(false);
        setTeam(prev => ({
          ...prev,
          shifts: (prev.shifts || []).map(s => {
            const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
            if (sEmp === form.employeeId.toString() && formatDateKey(s.date) === formatDateKey(form.date)) {
              return { ...s, isLocked: false };
            }
            return s;
          })
        }));
      } else {
        const { data } = await API.put('/shifts/lock', {
          employeeId: form.employeeId,
          dates: [form.date],
          shiftType: form.shiftType || 'Morning'
        }, { headers });
        toast.success(data.message || 'Shift schedule locked successfully! 🔒');
        setIsCurrentlyLocked(true);
        setTeam(prev => ({
          ...prev,
          shifts: (prev.shifts || []).map(s => {
            const sEmp = (s.employeeId?._id || s.employeeId || '').toString();
            if (sEmp === form.employeeId.toString() && formatDateKey(s.date) === formatDateKey(form.date)) {
              return { ...s, isLocked: true };
            }
            return s;
          })
        }));
      }
    } catch(e) {
      toast.error(e.response?.data?.message || 'Error updating lock status');
    }
  };

  const addShift = async (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.date) return toast.error('Select employee and date');
    setAdding(true);
    try {
      const { data } = await API.post(`/teams/${team._id}/shifts`, {
        ...form,
        isLocked: isCurrentlyLocked,
      }, { headers });
      setTeam(p => ({ ...p, shifts: [...(p.shifts||[]), data] }));
      toast.success('Shift assigned successfully! 📅');
      setForm({ employeeId: '', shiftType: 'Morning', date: '' });
      setIsCurrentlyLocked(false);
    } catch(e){ toast.error(e.response?.data?.message || 'Error assigning shift'); }
    finally { setAdding(false); }
  };

  const deleteShift = async (shift) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0);
    const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);

    if (shift.isLocked || today >= lockThreshold) {
      return toast.error('Cannot delete shift less than 1 day before it occurs, after it has passed, or when locked.');
    }

    try {
      await API.delete(`/teams/${team._id}/shifts/${shift._id}`, { headers });
      setTeam(p => ({ ...p, shifts: (p.shifts||[]).filter(s => s._id !== shift._id) }));
      toast.success('Shift deleted successfully');
    } catch(e) {
      toast.error(e.response?.data?.message || 'Error deleting shift');
    }
  };

  const getShiftBadge = (type) => {
    switch(type) {
      case 'General': return <span className="bg-primary-500/10 text-primary-400 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-primary-500/20">{type} (10AM–6PM)</span>;
      case 'Morning': return <span className="bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-amber-500/20">{type} (6AM–2PM)</span>;
      case 'Evening': return <span className="bg-violet-500/10 text-violet-400 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-violet-500/20">{type} (2PM–10PM)</span>;
      case 'Night': return <span className="bg-slate-500/20 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-slate-500/40">{type} (10PM–6AM)</span>;
      default: return <span>{type}</span>;
    }
  };

  const sortedShifts = [...(team.shifts || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-5">
      {/* Shift Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(SHIFT_INFO).map(([key, info]) => (
          <div key={key} className={`p-3 rounded-xl border ${info.bg}`}>
            <p className={`text-xs font-bold ${info.color}`}>{info.label}</p>
            <p className="text-[11px] text-surface-400 mt-0.5">{info.time}</p>
          </div>
        ))}
      </div>

      {/* Schedule Form */}
      {canSchedule && (
        <form onSubmit={addShift} className="glass-card p-4 space-y-3">
          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Schedule Shift</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select required className="input-field" value={form.employeeId} onChange={e => setForm(p => ({...p, employeeId: e.target.value}))}>
              <option value="">Select Member</option>
              {(team.members||[]).map(m => (
                <option key={m._id} value={m._id}>
                  {m.name} {m.employeeCode ? `(${m.employeeCode})` : ''}
                </option>
              ))}
            </select>
            <select className="input-field" value={form.shiftType} onChange={e => setForm(p => ({...p, shiftType: e.target.value}))}>
              <option value="Morning">Morning (6AM–2PM)</option>
              <option value="General">General (10AM–6PM)</option>
              <option value="Evening">Evening (2PM–10PM)</option>
              <option value="Night">Night (10PM–6AM)</option>
            </select>
            <input type="date" required className="input-field" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-surface-700/50">
            <button
              type="button"
              onClick={handleLockToggle}
              disabled={checkingLock || !form.employeeId || !form.date}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all ${
                isCurrentlyLocked 
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30' 
                  : 'bg-surface-700 text-surface-200 hover:bg-surface-600 border border-surface-600'
              }`}
            >
              {checkingLock ? (
                <span className="animate-pulse">Checking...</span>
              ) : isCurrentlyLocked ? (
                <>
                  <HiOutlineLockOpen className="w-4 h-4" />
                  Unlock Assigned Schedule
                </>
              ) : (
                <>
                  <HiOutlineLockClosed className="w-4 h-4" />
                  Lock Assigned Schedule
                </>
              )}
            </button>
            <button type="submit" disabled={adding} className="btn-primary text-xs py-2 px-5 font-semibold flex items-center gap-1.5">
              <HiOutlineCalendar className="w-4 h-4" />
              {adding ? 'Assigning...' : 'Assign Shift'}
            </button>
          </div>
        </form>
      )}

      {/* Shift Table */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Team Shift Schedule History</h4>

        {sortedShifts.length === 0 ? (
          <div className="text-center py-10 text-surface-500 text-sm">No shifts scheduled for this team yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-700/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-800/80 border-b border-surface-700/50 text-surface-300 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date ↑</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Shift Type</th>
                  <th className="py-3 px-4">Status</th>
                  {canSchedule && <th className="py-3 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/30 text-surface-300">
                {sortedShifts.map((s) => {
                  const sDate = new Date(s.date);
                  const formattedDate = sDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });
                  
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const shiftDate = new Date(s.date);
                  shiftDate.setHours(0, 0, 0, 0);
                  const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);
                  const isAutoLocked = today >= lockThreshold;
                  const isLocked = Boolean(s.isLocked || isAutoLocked);

                  return (
                    <tr key={s._id} className="hover:bg-surface-800/40 transition-colors">
                      <td className="font-semibold text-surface-200 whitespace-nowrap py-3 px-4">{formattedDate}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={s.employeeId} size="xs" />
                          <div>
                            <p className="text-xs font-semibold text-surface-200">
                              {s.employeeId?.name || 'Unknown'} {s.employeeId?.employeeCode && <span className="font-mono text-[10px] text-surface-400 ml-1">({s.employeeId.employeeCode})</span>}
                            </p>
                            <p className="text-[10px] text-surface-500">{s.employeeId?.designation || s.employeeId?.role || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getShiftBadge(s.shiftType)}</td>
                      <td className="py-3 px-4">
                        {isLocked ? (
                          isAutoLocked && !s.isLocked ? (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                              🔒 Auto-Locked
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                              🔒 Locked
                            </span>
                          )
                        ) : (
                          <span className="bg-surface-700 text-surface-300 border border-surface-600 px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                            🔓 Flexible
                          </span>
                        )}
                      </td>
                      {canSchedule && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => deleteShift(s)}
                            disabled={isLocked}
                            title={isLocked ? 'Cannot delete locked or past shift' : 'Delete Shift'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isLocked
                                ? 'text-surface-600 cursor-not-allowed opacity-40'
                                : 'hover:bg-rose-500/10 text-surface-400 hover:text-rose-400'
                            }`}
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TEAM CHAT
// ═══════════════════════════════════════════════════════════════════════════════
const ChatTab = ({ team, user, headers }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [connected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [editingMsg, setEditingMsg] = useState(null); // { _id, text }
  const [menuOpen, setMenuOpen] = useState(null); // message _id
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Chat notification sound (lighter pop sound for incoming messages)
  const playChatSound = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }, []);

  useEffect(() => {
    // Load history
    API.get(`/teams/${team._id}/chat`, { headers })
      .then(r => setMessages(r.data)).catch(console.error);

    // Socket
    const socket = io(import.meta.env.DEV ? window.location.origin : 'https://employee-tracker-backend-6t0z.onrender.com', { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); socket.emit('join-team', team._id); });
    socket.on('disconnect', () => setConnected(false));
    
    socket.on('team-message', (msg) => {
      setMessages(prev => [...prev, msg]);
      // Play sound for messages from others
      if ((msg.senderId?._id || msg.senderId) !== user._id) {
        playChatSound();
      }
    });

    // Edit & Delete real-time
    socket.on('message-edited', (data) => {
      setMessages(prev => prev.map(m => m._id === data._id ? { ...m, message: data.message, isEdited: true, editedAt: data.editedAt } : m));
    });
    socket.on('message-deleted', (data) => {
      setMessages(prev => prev.map(m => m._id === data._id ? { ...m, isDeleted: true, message: '' } : m));
    });

    // Typing indicators
    socket.on('user-typing', (data) => {
      setTypingUsers(prev => ({ ...prev, [data.userId]: data.userName }));
    });
    socket.on('user-stop-typing', (data) => {
      setTypingUsers(prev => { const n = { ...prev }; delete n[data.userId]; return n; });
    });

    return () => { socket.emit('leave-team', team._id); socket.disconnect(); };
  }, [team._id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typingUsers]);

  // Typing emit logic with debounce
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socketRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('typing', { teamId: team._id, userId: user._id, userName: user.name });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socketRef.current?.emit('stop-typing', { teamId: team._id, userId: user._id });
    }, 2000);
  };

  const send = () => {
    if (!input.trim() || !socketRef.current) return;
    // Stop typing indicator
    isTypingRef.current = false;
    clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit('stop-typing', { teamId: team._id, userId: user._id });
    
    socketRef.current.emit('team-message', {
      teamId: team._id, senderId: user._id,
      senderName: user.name, senderAvatar: user.profilePicture,
      message: input.trim(),
    });
    setInput('');
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  // Edit message
  const startEdit = (msg) => {
    setEditingMsg({ _id: msg._id, text: msg.message });
    setMenuOpen(null);
  };
  const cancelEdit = () => setEditingMsg(null);
  const saveEdit = async () => {
    if (!editingMsg || !editingMsg.text.trim()) return;
    try {
      await API.put(`/teams/${team._id}/chat/${editingMsg._id}`, { message: editingMsg.text.trim() }, { headers });
      setEditingMsg(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to edit message');
    }
  };
  const handleEditKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') cancelEdit(); };

  // Delete message
  const deleteMsg = async (msgId) => {
    setMenuOpen(null);
    try {
      await API.delete(`/teams/${team._id}/chat/${msgId}`, { headers });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message');
    }
  };

  // Check if message is within 10 min edit window
  const canEdit = (msg) => {
    return Date.now() - new Date(msg.createdAt).getTime() < 10 * 60 * 1000;
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handler = () => setMenuOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Typing indicator text
  const typingNames = Object.values(typingUsers);
  const typingText = typingNames.length === 1
    ? `${typingNames[0]} is typing`
    : typingNames.length === 2
    ? `${typingNames[0]} and ${typingNames[1]} are typing`
    : typingNames.length > 2
    ? `${typingNames[0]} and ${typingNames.length - 1} others are typing`
    : '';

  return (
    <div className="flex flex-col h-[60vh]">
      {/* Status bar */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        <span className="text-xs text-surface-500">{connected ? 'Connected' : 'Connecting...'}</span>
        <span className="text-xs text-surface-600 ml-auto">{team.members?.length || 0} members in this team</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-surface-900/50 rounded-xl border border-surface-700/40 mb-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-surface-500 text-sm">No messages yet. Say hello! 👋</div>
        )}
        {messages.map((msg, i) => {
          const isMe = (msg.senderId?._id || msg.senderId) === user._id;
          const isDeleted = msg.isDeleted;
          const isEditing = editingMsg && editingMsg._id === msg._id;

          return (
            <div key={msg._id || i} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''} group`}>
              <UserAvatar user={msg.senderId} size="xs" />
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5 relative`}>
                {!isMe && (
                  <span className="text-[10px] text-surface-500 px-1">
                    {msg.senderId?.name || msg.senderName || 'Member'} {msg.senderId?.employeeCode ? `(${msg.senderId.employeeCode})` : ''}
                  </span>
                )}

                {isDeleted ? (
                  <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed bg-surface-800/30 text-surface-500 italic border border-surface-700/30 rounded-tr-sm">
                    🚫 This message was deleted
                  </div>
                ) : isEditing ? (
                  <div className="flex flex-col gap-1.5 w-full min-w-[200px]">
                    <input
                      autoFocus
                      value={editingMsg.text}
                      onChange={e => setEditingMsg({ ...editingMsg, text: e.target.value })}
                      onKeyDown={handleEditKey}
                      className="input-field text-sm py-2 px-3"
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={cancelEdit} className="text-xs text-surface-500 hover:text-surface-300 px-2 py-1 rounded-lg hover:bg-surface-700/50 transition-colors">Cancel</button>
                      <button onClick={saveEdit} className="text-xs text-primary-400 hover:text-primary-300 px-2 py-1 rounded-lg hover:bg-primary-500/10 transition-colors font-medium">Save ✓</button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed border border-surface-700/30 ${isMe ? 'bg-primary-500/20 text-primary-100 rounded-tr-sm' : 'bg-surface-800 text-surface-200 rounded-tl-sm'}`}>
                      {msg.message}
                    </div>
                    {/* Action menu for own messages */}
                    {isMe && !isDeleted && (
                      <div className={`absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full ${menuOpen === msg._id ? 'flex' : 'hidden group-hover:flex'} items-center gap-1 pr-2`}>
                        {canEdit(msg) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(msg); }}
                            className="p-1.5 rounded-lg bg-surface-800/80 hover:bg-surface-700 text-surface-400 hover:text-amber-400 transition-all text-xs shadow-sm border border-surface-700/50"
                            title="Edit (within 10 min)"
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMsg(msg._id); }}
                          className="p-1.5 rounded-lg bg-surface-800/80 hover:bg-surface-700 text-surface-400 hover:text-rose-400 transition-all text-xs shadow-sm border border-surface-700/50"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] text-surface-600">{new Date(msg.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                  {msg.isEdited && !isDeleted && (
                    <span className="text-[9px] text-surface-500 italic">(edited)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingText && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-surface-500 italic">{typingText}...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="input-field flex-1"
          placeholder="Type a message... (Enter to send)"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKey}
        />
        <button onClick={send} disabled={!input.trim() || !connected} className="btn-primary px-5">Send</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TEAM ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════════
const AttendanceTab = ({ team, user, headers }) => {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2,'0'));
  const [year,  setYear]  = useState(String(now.getFullYear()));
  const [data,  setData]  = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAtt = async () => {
    setLoading(true);
    try {
      const { data: d } = await API.get(`/teams/${team._id}/attendance?month=${month}&year=${year}`, { headers });
      setData(d);
    } catch(e){ 
      console.error('Attendance fetch error:', e);
      alert(e.response?.data?.message || 'Error loading attendance'); 
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAtt(); }, [team._id, month, year]);

  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getRecord = (memberId, day) => {
    if (!data || !data.records) return null;
    const targetDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const mIdStr = (memberId?._id || memberId || '').toString();
    return data.records.find(r => {
      const rd = typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0];
      const rEmpId = (r.employeeId?._id || r.employeeId || '').toString();
      return rd === targetDate && rEmpId === mIdStr;
    });
  };

  const membersList = (data?.team?.members && data.team.members.length > 0) ? data.team.members : (team.members || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Team Attendance Sheet</h4>
          <p className="text-[11px] text-surface-500">Live attendance for members of {team.projectName}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <select className="input-field py-1.5 px-3 text-xs bg-surface-800 w-auto min-w-[130px]" value={month} onChange={e => setMonth(e.target.value)}>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i) => (
              <option key={m} value={m}>{new Date(2000,i).toLocaleString('default',{month:'long'})}</option>
            ))}
          </select>
          <select className="input-field py-1.5 px-3 text-xs bg-surface-800 w-auto min-w-[85px]" value={year} onChange={e => setYear(e.target.value)}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
          <button onClick={fetchAtt} className="p-1.5 rounded-lg border border-surface-700 hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors" title="Refresh attendance">
            <HiOutlineRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-700/40">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-700/50 bg-surface-800/40">
                <th className="text-left py-2.5 px-3 text-surface-300 font-semibold min-w-[220px] sticky left-0 bg-surface-900 z-10">Employee</th>
                {days.map(d => {
                  return (
                    <th key={d} className={`py-2 px-1 text-center font-medium min-w-[28px] text-surface-400`}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/20">
              {membersList.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 1} className="py-8 text-center text-surface-500">
                    No team members assigned to this team yet.
                  </td>
                </tr>
              ) : (
                membersList.map(member => (
                  <tr key={member._id || member} className="hover:bg-surface-800/30 transition-colors">
                    <td className="py-2.5 px-3 sticky left-0 bg-surface-900 z-10 border-r border-surface-700/30">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={member} size="xs" />
                        <div className="min-w-0">
                          <p className="font-semibold text-surface-200 truncate max-w-[200px]">
                            {member.name || 'Member'} {member.employeeCode && <span className="font-mono text-[10px] text-surface-400">({member.employeeCode})</span>}
                          </p>
                          <p className="text-[10px] text-surface-500 truncate max-w-[200px]">{member.designation || member.role || 'Employee'}</p>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const rec = getRecord(member._id || member, d);
                      const s = rec?.status || null;
                      const dow = new Date(Number(year), Number(month)-1, d).getDay();
                      const cellDate = new Date(Number(year), Number(month)-1, d);
                      cellDate.setHours(0,0,0,0);
                      
                      let isEmployeeHoliday = false;
                      if (member.holidayStartDate && member.weeklyHolidays?.length > 0) {
                        const start = new Date(member.holidayStartDate);
                        start.setHours(0,0,0,0);
                        const validUntil = member.holidayValidUntil ? new Date(member.holidayValidUntil) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
                        validUntil.setHours(23,59,59,999);
                        if (cellDate >= start && cellDate <= validUntil && member.weeklyHolidays.includes(dow)) {
                          isEmployeeHoliday = true;
                        }
                      }
                      
                      
                      const timeStr = rec?.checkIn ? new Date(rec.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
                      const tooltip = rec ? `${member.name}: ${s}${timeStr ? ` (${timeStr})` : ''}` : isEmployeeHoliday ? 'Holiday' : 'Not Checked In';
                      
                      return (
                        <td key={d} className={`py-2 px-1 text-center ${isEmployeeHoliday ? 'bg-surface-800/10' : ''}`} title={tooltip}>
                          {isEmployeeHoliday ? (
                            <span className="text-surface-700 font-mono text-[11px]"></span>
                          ) : s === 'Present' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px]">P</span>
                          ) : s === 'Late' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold text-[10px]">L</span>
                          ) : s === 'Absent' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold text-[10px]">A</span>
                          ) : (
                            <span className="text-surface-700 text-xs">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 text-xs text-surface-400 px-2 pt-1">
        <span className="flex items-center gap-1.5"><span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[10px]">P</span> = Present</span>
        <span className="flex items-center gap-1.5"><span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold text-[10px]">L</span> = Late</span>
        <span className="flex items-center gap-1.5"><span className="inline-block px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 font-bold text-[10px]">A</span> = Absent</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════════
const DocsTab = ({ team, setTeam, user, headers }) => {
  const [mode, setMode]     = useState(null); // 'text' | 'file'
  const [docName, setDocName] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const isCreator = (team.createdBy?._id || team.createdBy) === user?._id;
  const isLead = (team.teamLead?._id || team.teamLead) === user?._id;
  const isMember = (team.members || []).some(m => (m._id || m) === user?._id);
  const canAdd = isCreator || isLead || isMember || canManage(user) || ['Admin', 'HR'].includes(user?.role);

  const canDeleteDoc = (doc) => {
    if (!user) return false;
    if (['Admin', 'HR'].includes(user.role)) return true;
    if (canManage(user)) return true;
    const isDocUploader = (doc.uploadedBy?._id || doc.uploadedBy) === user._id;
    return isCreator || isLead || isDocUploader;
  };

  const submitText = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { data } = await API.post(`/teams/${team._id}/documents`, { type:'text', filename: docName || 'Untitled', content }, { headers });
      setTeam(p => ({ ...p, documents: [...(p.documents||[]), data] }));
      setMode(null); setContent(''); setDocName('');
      toast.success('Document saved successfully');
    } catch(e){ toast.error(e.response?.data?.message || 'Error saving document'); }
    finally { setSaving(false); }
  };

  const submitFile = async () => {
    if (!file) return;
    setSaving(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await API.post(`/teams/${team._id}/documents`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      setTeam(p => ({ ...p, documents: [...(p.documents||[]), data] }));
      setMode(null); setFile(null);
      toast.success('File uploaded successfully');
    } catch(e){ toast.error(e.response?.data?.message || 'Error uploading file'); }
    finally { setSaving(false); }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      await API.delete(`/teams/${team._id}/documents/${docToDelete._id}`, { headers });
      setTeam(p => ({ ...p, documents: (p.documents||[]).filter(d => d._id !== docToDelete._id) }));
      toast.success('Document deleted successfully');
      setDocToDelete(null);
    } catch(e){ 
      console.error('Delete document error:', e);
      toast.error(e.response?.data?.message || 'Failed to delete document'); 
    } finally {
      setDeletingDoc(false);
    }
  };

  return (
    <div className="space-y-5">
      {canAdd && (
        <div className="flex gap-2">
          <button onClick={() => setMode('text')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${mode==='text' ? 'bg-primary-500/15 text-primary-400 border-primary-500/20' : 'btn-secondary'}`}>
            <HiOutlinePencil className="w-3.5 h-3.5" /> Write Document
          </button>
          <button onClick={() => setMode('file')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${mode==='file' ? 'bg-primary-500/15 text-primary-400 border-primary-500/20' : 'btn-secondary'}`}>
            <HiOutlineUpload className="w-3.5 h-3.5" /> Upload File
          </button>
        </div>
      )}

      {mode === 'text' && (
        <div className="glass-card p-4 space-y-3">
          <input className="input-field" placeholder="Document title..." value={docName} onChange={e => setDocName(e.target.value)} />
          <textarea rows={8} className="input-field resize-none font-mono text-sm" placeholder="Write your documentation here..." value={content} onChange={e => setContent(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={submitText} disabled={saving || !content.trim()} className="btn-primary text-sm py-2 px-5">{saving ? 'Saving...' : '💾 Save Document'}</button>
            <button onClick={() => setMode(null)} className="btn-secondary text-sm py-2 px-5">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'file' && (
        <div className="glass-card p-4 space-y-3">
          <div className="border-2 border-dashed border-surface-600 rounded-xl p-8 text-center hover:border-primary-500/40 transition-colors">
            <HiOutlineUpload className="w-8 h-8 text-surface-500 mx-auto mb-2" />
            <p className="text-sm text-surface-400 mb-2">Click to select file (max 10MB)</p>
            <input type="file" className="hidden" id="doc-upload" onChange={e => setFile(e.target.files[0])} />
            <label htmlFor="doc-upload" className="btn-secondary text-sm cursor-pointer">Choose File</label>
            {file && <p className="text-xs text-primary-400 mt-2">Selected: {file.name}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={submitFile} disabled={saving || !file} className="btn-primary text-sm py-2 px-5">{saving ? 'Uploading...' : '📤 Upload'}</button>
            <button onClick={() => { setMode(null); setFile(null); }} className="btn-secondary text-sm py-2 px-5">Cancel</button>
          </div>
        </div>
      )}

      {/* Document List */}
      {(team.documents||[]).length === 0 ? (
        <div className="text-center py-10 text-surface-500 text-sm">No documents yet.</div>
      ) : (
        <div className="space-y-2.5">
          {(team.documents||[]).map(doc => (
            <div key={doc._id} className="glass-card p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.type === 'file' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                  {doc.type === 'file' ? <HiOutlineUpload className="w-4 h-4 text-blue-400" /> : <HiOutlinePencil className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-200 truncate">{doc.filename || 'Untitled'}</p>
                  <p className="text-[10px] text-surface-500">
                    {doc.type === 'file' ? '📎 File' : '📝 Text'} · By {doc.uploadedBy?.name || 'Unknown'}{doc.uploadedBy?.employeeCode ? ` (${doc.uploadedBy.employeeCode})` : ''} · {new Date(doc.uploadedAt).toLocaleDateString('en-IN')}
                  </p>
                  {doc.type === 'text' && doc.content && (
                    <p className="text-xs text-surface-400 mt-1.5 line-clamp-2 font-mono bg-surface-800/50 rounded p-2">{doc.content}</p>
                  )}
                  {doc.type === 'file' && doc.fileUrl && (
                    <a href={`${BACKEND_URL}${doc.fileUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary-400 hover:underline mt-1 inline-block">⬇ Download</a>
                  )}
                </div>
              </div>
              {canDeleteDoc(doc) && (
                <button 
                  onClick={() => setDocToDelete(doc)} 
                  disabled={deletingDoc}
                  title="Delete Document"
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-surface-500 hover:text-rose-400 flex-shrink-0 transition-colors disabled:opacity-50"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document Delete Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        onConfirm={handleConfirmDeleteDoc}
        title="Delete Document"
        message="Are you sure you want to delete this document from the team repository?"
        itemName={docToDelete?.filename || 'Untitled Document'}
        confirmText="Confirm Delete Document"
        loading={deletingDoc}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM HISTORY CARD
// ═══════════════════════════════════════════════════════════════════════════════
const TeamHistoryCard = ({ item, user, onOpen, onRequestDelete }) => {
  const isAdmin = ['Admin', 'HR'].includes(user?.role);
  const des = (user?.designation || user?.role || '').toLowerCase();
  const isPM = des.includes('project manager') || des.includes('program manager') || des.includes('operations manager');
  const canDelete = isAdmin || isPM;

  const handleDelete = (e) => {
    e.stopPropagation();
    onRequestDelete(item);
  };

  return (
    <div onClick={() => onOpen(item)} className="glass-card p-5 cursor-pointer hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-purple-400 font-bold">{item.teamId}</span>
          <h3 className="text-base font-bold text-surface-100 mt-0.5 group-hover:text-purple-300 transition-colors">{item.projectName}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center gap-1">
            <HiOutlineArchive className="w-3.5 h-3.5" /> Archived
          </span>
          {canDelete && (
            <button
              onClick={handleDelete}
              title="Delete archive record permanently"
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-surface-500 hover:text-rose-400 transition-colors"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="flex items-center gap-1.5 mb-3">
        {(item.members || []).slice(0, 5).map((m, i) => (
          <div key={m._id || i} style={{ zIndex: 5 - i }} className="-ml-1 first:ml-0 ring-2 ring-surface-900 rounded-full">
            <UserAvatar user={m} size="xs" />
          </div>
        ))}
        {item.members?.length > 5 && <span className="text-xs text-surface-500 ml-1">+{item.members.length - 5}</span>}
        <span className="ml-auto text-xs text-surface-500">{item.members?.length || 0} members</span>
      </div>

      {/* Tech Stack */}
      {item.techStack?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {item.techStack.slice(0, 4).map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-surface-800 text-surface-400 border border-surface-700/50">{t}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-surface-700/40 text-xs text-surface-400">
        <span>Completed: {item.completedAt || item.createdAt ? new Date(item.completedAt || item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
        <span className="text-purple-400 font-semibold group-hover:underline flex items-center gap-1">
          <HiOutlineCollection className="w-3.5 h-3.5" /> View Snapshot
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM HISTORY DRAWER (READ-ONLY ARCHIVE SNAPSHOT)
// ═══════════════════════════════════════════════════════════════════════════════
const TeamHistoryDrawer = ({ item, user, onClose, onRequestDelete }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const isAdmin = ['Admin', 'HR'].includes(user?.role);
  const des = (user?.designation || user?.role || '').toLowerCase();
  const isPM = des.includes('project manager') || des.includes('program manager') || des.includes('operations manager');
  const canDelete = isAdmin || isPM;

  return (
    <div className="fixed inset-0 bg-surface-950/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="glass-card w-full max-w-5xl min-h-[85vh] animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-surface-700/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-purple-400">{item.teamId}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center gap-1">
                <HiOutlineArchive className="w-3.5 h-3.5" /> Archived Snapshot
              </span>
            </div>
            <h2 className="text-xl font-display font-bold text-surface-100">{item.projectName}</h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Completed & Archived on {item.completedAt || item.createdAt ? new Date(item.completedAt || item.createdAt).toLocaleString('en-IN') : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={() => onRequestDelete(item)}
                className="px-3 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1.5 text-xs font-bold"
                title="Delete Archive Record"
              >
                <HiOutlineTrash className="w-4 h-4" /> Delete Archive
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400 transition-colors">
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-3 border-b border-surface-700/40 overflow-x-auto">
          {['overview', 'members', 'progress', 'shifts', 'docs'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === t
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Project Summary</h4>
                <InfoRow label="Team ID" value={item.teamId} />
                <InfoRow label="Project Name" value={item.projectName} />
                <InfoRow label="Start Date" value={item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN') : '—'} />
                <InfoRow label="End Date" value={item.endDate ? new Date(item.endDate).toLocaleDateString('en-IN') : '—'} />
                <InfoRow label="Archived At" value={item.completedAt || item.createdAt ? new Date(item.completedAt || item.createdAt).toLocaleString('en-IN') : '—'} />
                <InfoRow label="Total Members" value={`${item.members?.length || 0} employees`} />
              </div>
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Tech Stack & Team Lead</h4>
                <div className="mb-3">
                  <span className="text-xs text-surface-500 block mb-1">Team Lead:</span>
                  <span className="text-sm font-bold text-amber-400">
                    {item.teamLead ? `${item.teamLead.name}${item.teamLead.employeeCode ? ` (${item.teamLead.employeeCode})` : ''}` : 'None assigned'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-surface-500 block mb-2">Technologies Used:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(item.techStack || []).map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4">
                Archived Member Roster ({item.members?.length || 0})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(item.members || []).map((m, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700/30">
                    <UserAvatar user={m} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-surface-200">
                        {m.name} {m.employeeCode && <span className="font-mono text-xs text-primary-400 font-bold">({m.employeeCode})</span>}
                      </p>
                      <p className="text-xs text-surface-500">{m.designation || m.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Archived Progress Updates</h4>
              {(item.progressUpdates || []).length === 0 ? (
                <div className="text-surface-500 text-sm py-8 text-center">No progress updates recorded before archiving.</div>
              ) : (
                item.progressUpdates.map((u, i) => (
                  <div key={i} className="glass-card p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-surface-400">
                      <span className="font-bold text-surface-200">
                        {u.submittedBy?.name} {u.submittedBy?.employeeCode ? `(${u.submittedBy.employeeCode})` : ''}
                      </span>
                      <span>{new Date(u.submittedAt).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-sm text-surface-300">{u.message}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'shifts' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Archived Shift Records ({item.shifts?.length || 0})</h4>
              {(item.shifts || []).length === 0 ? (
                <div className="text-surface-500 text-sm py-8 text-center">No shift records archived for this team.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-surface-700/50">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-surface-800/80 text-surface-400 uppercase">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Shift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-700/30 text-surface-300">
                      {item.shifts.map((s, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3">{new Date(s.date).toLocaleDateString('en-GB')}</td>
                          <td className="py-2 px-3 font-semibold text-surface-200">
                            {s.employeeId?.name || 'Unknown'} {s.employeeId?.employeeCode ? `(${s.employeeId.employeeCode})` : ''}
                          </td>
                          <td className="py-2 px-3">{s.shiftType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Archived Documents ({item.documents?.length || 0})</h4>
              {(item.documents || []).length === 0 ? (
                <div className="text-surface-500 text-sm py-8 text-center">No documents archived.</div>
              ) : (
                item.documents.map((doc, i) => (
                  <div key={i} className="glass-card p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-surface-200">{doc.filename}</p>
                      <p className="text-surface-500 text-[10px]">
                        Uploaded by {doc.uploadedBy?.name} {doc.uploadedBy?.employeeCode ? `(${doc.uploadedBy.employeeCode})` : ''}
                      </p>
                    </div>
                    {doc.fileUrl && (
                      <a href={`${BACKEND_URL}${doc.fileUrl}`} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">
                        Download
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamsPage;

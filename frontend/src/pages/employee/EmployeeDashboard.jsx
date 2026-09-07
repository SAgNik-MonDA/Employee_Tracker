import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import ProfilePictureUploader from '../../components/common/ProfilePictureUploader';
import BirthdayBanner from '../../components/common/BirthdayBanner';
import AttendanceCameraModal from '../../components/common/AttendanceCameraModal';
import toast from 'react-hot-toast';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalLeaves: 0,
    currentRating: '-',
    lastSalary: '-',
  });
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [actionType, setActionType] = useState('check-in');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      const month = (now.getMonth() + 1).toString();
      const year = now.getFullYear().toString();
      const localDate = now.toLocaleDateString('en-CA');

      const results = await Promise.allSettled([
        API.get(`/attendance/my-history?month=${month}&year=${year}`),
        API.get('/leaves/my-leaves'),
        API.get('/performance/my-reviews'),
        API.get('/payroll/my-slips'),
        API.get(`/attendance/today?clientDate=${localDate}`),
        API.get('/leaves/my-balance'),
      ]);

      const [attendanceRes, leavesRes, performanceRes, payslipsRes, todayRes, balanceRes] = results;

      if (balanceRes.status === 'fulfilled') setLeaveBalance(balanceRes.value.data);

      const attendanceData = attendanceRes.status === 'fulfilled' ? attendanceRes.value.data : [];
      const leavesData = leavesRes.status === 'fulfilled' ? leavesRes.value.data : [];
      const performanceData = performanceRes.status === 'fulfilled' ? performanceRes.value.data : [];
      const payslipsData = payslipsRes.status === 'fulfilled' ? payslipsRes.value.data : [];

      const presentDays = attendanceData.filter(
        (a) => a.status === 'Present' || a.status === 'Late'
      ).length;

      const approvedLeaves = leavesData
        .filter((l) => l.status === 'Approved')
        .reduce((sum, l) => {
          const days = l.days || (Math.ceil((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 60 * 60 * 24)) + 1);
          return sum + days;
        }, 0);

      const latestRating = performanceData.length > 0
        ? performanceData[0].kpiRating
        : '-';

      const lastPayslip = payslipsData.length > 0
        ? `₹${payslipsData[0].netSalary.toLocaleString()}`
        : '-';

      setStats({
        totalPresent: presentDays,
        totalLeaves: approvedLeaves,
        currentRating: latestRating,
        lastSalary: lastPayslip,
      });

      if (todayRes.status === 'fulfilled') setTodayStatus(todayRes.value.data);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = () => {
    setActionType('check-in');
    setCameraModalOpen(true);
  };

  const handleCheckOut = () => {
    setActionType('check-out');
    setCameraModalOpen(true);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="w-12 h-12 bg-surface-700 rounded-xl mb-4"></div>
            <div className="w-20 h-8 bg-surface-700 rounded mb-2"></div>
            <div className="w-28 h-4 bg-surface-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const checkIsHolidayToday = () => {
    if (todayStatus?.isHoliday !== undefined && todayStatus.isHoliday) {
      return true;
    }
    if (!user || !Array.isArray(user.weeklyHolidays) || user.weeklyHolidays.length === 0) return false;
    const todayDay = new Date().getDay();
    if (!user.weeklyHolidays.includes(todayDay)) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.holidayStartDate) {
      const start = new Date(user.holidayStartDate);
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      if (today < startDateOnly) return false;
    }
    if (user.holidayValidUntil) {
      const until = new Date(user.holidayValidUntil);
      const untilDateOnly = new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59, 59, 999);
      if (today > untilDateOnly) return false;
    }
    return true;
  };

  const isTodayHoliday = checkIsHolidayToday();

  return (
    <div className="space-y-8">
      {/* Birthday Banner (Shown if today is user's birthday) */}
      <BirthdayBanner />

      {/* Holiday Banner */}
      {isTodayHoliday && (
        <div className="glass-card bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/15 border border-amber-500/30 p-4 flex items-center justify-between text-amber-300 shadow-xl backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-amber-200 text-base">Today is your Weekly Holiday!</p>
              <p className="text-xs text-amber-300/80">Attendance check-in & check-out actions are disabled for today. Have a relaxed day!</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
            Holiday Off Day
          </span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Employee Dashboard</h1>
        <p className="text-surface-500 mt-1">Your overview at a glance</p>
      </div>


      {/* Profile Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar uploader */}
          <ProfilePictureUploader />

          {/* User info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-display font-bold text-surface-100">{user?.name}</h2>
            <p className="text-primary-400 font-medium mt-1">{user?.designation || 'No designation set'}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 justify-center sm:justify-start">
              <span className="text-sm text-surface-400">
                🏢 <span className="text-surface-300">{user?.department || 'No department'}</span>
              </span>
              <span className="text-sm text-surface-400">
                📧 <span className="text-surface-300">{user?.email}</span>
              </span>
              <span className="text-sm text-surface-400">
                🗓️ Joined <span className="text-surface-300">
                  {user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '-'}
                </span>
              </span>
              {user?.weeklyHolidays?.length > 0 && (
                <span className="text-sm text-surface-400">
                  🎉 Weekly Off 
                  {user.holidayStartDate && user.holidayValidUntil && (
                    <span className="text-surface-500 mx-1">
                      ({new Date(user.holidayStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(user.holidayValidUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                    </span>
                  )}
                  : <span className="text-amber-400 font-bold ml-1">
                    {user.weeklyHolidays.map((d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(' & ')}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-surface-600 mt-3">
              💡 Hover over your photo to change it • Max 2MB • JPG/PNG/WebP
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon="✅" label="Days Present (This Month)" value={stats.totalPresent} color="emerald" />
        <StatCard icon="📅" label="Total Leaves Taken" value={stats.totalLeaves} color="amber" />
        <StatCard icon="⭐" label="Current KPI Rating" value={stats.currentRating === '-' ? 'Not Reviewed' : `${stats.currentRating}/5`} color="violet" />
        <StatCard icon="💰" label="Last Salary" value={stats.lastSalary} color="cyan" />
      </div>

      {/* Leave Balance Section */}
      {leaveBalance && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-bold text-surface-100 mb-4">
            🗓️ Leave Balance — {leaveBalance.year}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Casual */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-surface-300">Casual Leave</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  leaveBalance.casual.remaining === 0
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {leaveBalance.casual.remaining} days left
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.round((leaveBalance.casual.used / leaveBalance.casual.total) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1.5">
                <span>{leaveBalance.casual.used} used</span>
                <span>{leaveBalance.casual.total} total</span>
              </div>
            </div>

            {/* Emergency */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-surface-300">Emergency Leave</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  leaveBalance.emergency.remaining === 0
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {leaveBalance.emergency.remaining} days left
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.round((leaveBalance.emergency.used / leaveBalance.emergency.total) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-surface-500 mt-1.5">
                <span>{leaveBalance.emergency.used} used</span>
                <span>{leaveBalance.emergency.total} total</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions & Shift Info */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-lg font-display font-bold text-surface-100">Today's Shift & Actions</h2>
          {todayStatus?.expectedShift && (
            <span className="text-sm px-3 py-1 bg-primary-500/10 text-primary-400 rounded-full border border-primary-500/20 font-medium">
              Assigned Shift: {todayStatus.expectedShift}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          {!todayStatus?.checkIn ? (
            <button
              onClick={handleCheckIn}
              disabled={isTodayHoliday}
              className={`btn-success flex items-center gap-2 ${
                isTodayHoliday
                  ? 'opacity-50 cursor-not-allowed bg-surface-800 text-surface-500 border-surface-700/50 shadow-none hover:bg-surface-800'
                  : ''
              }`}
              title={isTodayHoliday ? 'Check-in disabled on weekly holidays' : ''}
            >
              🕐 Check In
            </button>
          ) : !todayStatus?.checkOut ? (
            <>
              <button
                onClick={handleCheckOut}
                disabled={isTodayHoliday}
                className={`btn-danger flex items-center gap-2 ${
                  isTodayHoliday
                    ? 'opacity-50 cursor-not-allowed bg-surface-800 text-surface-500 border-surface-700/50 shadow-none hover:bg-surface-800'
                    : ''
                }`}
                title={isTodayHoliday ? 'Check-out disabled on weekly holidays' : ''}
              >
                👋 Check Out
              </button>
              {/* Emergency Checkout logic... */}
              {todayStatus.earlyCheckoutStatus === 'Approved' ? (
                <span className="text-sm font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  Emergency Checkout: Approved
                </span>
              ) : todayStatus.earlyCheckoutStatus?.startsWith('Pending') ? (
                <span className="text-sm font-medium text-amber-400 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  Emergency Checkout: Pending Approval
                </span>
              ) : !isTodayHoliday && (
                <button onClick={() => setShowEarlyCheckoutModal(true)} className="btn-secondary text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30">
                  Emergency Check-out Request
                </button>
              )}
            </>
          ) : (
            <span className="text-emerald-400 font-medium flex items-center gap-2">
              <span className="text-xl">✅</span> Shift Completed for Today
            </span>
          )}
        </div>
        {todayStatus?.checkIn && !todayStatus?.checkOut && (
           <p className="text-xs text-surface-400 mt-4">
             Ensure you check out after your shift ends to avoid early check-out penalties.
           </p>
        )}
      </div>

      {/* Face Authentication Camera Modal */}
      <AttendanceCameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        actionType={actionType}
        onSuccess={() => {
          setCameraModalOpen(false);
          fetchDashboardData();
        }}
      />

      {/* Early Checkout Modal */}
      {showEarlyCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface-700/50 flex justify-between items-center bg-surface-800/30">
              <h3 className="font-display font-semibold text-surface-100">Emergency Check-out Request</h3>
              <button onClick={() => setShowEarlyCheckoutModal(false)} className="p-1 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-surface-400">Please provide a reason for early check-out.</p>
              <textarea
                value={earlyCheckoutReason}
                onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                placeholder="Enter reason..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-600 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-primary-500 resize-none"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowEarlyCheckoutModal(false)} className="px-4 py-2 rounded-lg font-medium text-sm text-surface-300 hover:bg-surface-700/50 transition-colors">Cancel</button>
                <button
                  onClick={async () => {
                    try {
                      await API.post('/attendance/early-checkout', { reason: earlyCheckoutReason });
                      toast.success('Emergency check-out request submitted!');
                      setShowEarlyCheckoutModal(false);
                      setEarlyCheckoutReason('');
                      fetchDashboardData();
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Failed to submit request');
                    }
                  }}
                  disabled={!earlyCheckoutReason.trim()}
                  className="px-4 py-2 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;

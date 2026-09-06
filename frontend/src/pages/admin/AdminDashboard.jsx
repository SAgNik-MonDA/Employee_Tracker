import { useState, useEffect } from 'react';
import API from '../../api/axios';
import StatCard from '../../components/common/StatCard';
import BirthdayBanner from '../../components/common/BirthdayBanner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    payrollThisMonth: 0,
  });
  const [attendanceDist, setAttendanceDist] = useState([]);
  const [deptSalary, setDeptSalary] = useState([]);
  const [pendingEarlyCheckouts, setPendingEarlyCheckouts] = useState([]);
  const [pendingFaceResets, setPendingFaceResets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      const [employeesRes, todayAttendanceRes, leavesRes, payrollRes, earlyCheckoutRes] = await Promise.all([
        API.get('/auth/employees'),
        API.get(`/attendance/all?date=${today}`),
        API.get('/leaves/all-requests?status=Pending'),
        API.get(`/payroll/all?monthYear=${monthYear}`),
        API.get('/attendance/early-checkout/pending').catch(() => ({ data: [] })),
      ]);

      const employees = employeesRes.data;
      const todayAtt = todayAttendanceRes.data;
      setPendingEarlyCheckouts(earlyCheckoutRes.data);
      setPendingFaceResets(employees.filter(e => e.faceResetRequest === 'Pending'));

      // Stats
      const presentCount = todayAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length;
      const totalPayroll = payrollRes.data.reduce((sum, p) => sum + p.netSalary, 0);

      setStats({
        totalEmployees: employees.length,
        presentToday: presentCount,
        pendingLeaves: leavesRes.data.length,
        payrollThisMonth: totalPayroll,
      });

      // Attendance distribution pie chart
      const present = todayAtt.filter((a) => a.status === 'Present').length;
      const late = todayAtt.filter((a) => a.status === 'Late').length;
      const absent = employees.filter((e) => e.role !== 'Admin').length - present - late;
      setAttendanceDist([
        { name: 'Present', value: present, color: '#10b981' },
        { name: 'Late', value: late, color: '#f59e0b' },
        { name: 'Absent', value: Math.max(0, absent), color: '#f43f5e' },
      ]);

      // Department-wise salary
      const deptMap = {};
      payrollRes.data.forEach((p) => {
        const dept = p.employeeId?.department || 'Other';
        deptMap[dept] = (deptMap[dept] || 0) + p.netSalary;
      });
      setDeptSalary(Object.entries(deptMap).map(([name, salary]) => ({ name, salary })));
    } catch (error) {
      console.error('Admin dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewEarlyCheckout = async (id, status) => {
    try {
      await API.put(`/attendance/early-checkout/${id}`, { status });
      toast.success(`Early checkout ${status.toLowerCase()}`);
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to review request');
    }
  };

  const handleReviewFaceReset = async (id, status) => {
    try {
      await API.put(`/auth/approve-face-reset/${id}`, { status });
      toast.success(`Face reset request ${status.toLowerCase()}`);
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to review face reset request');
    }
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

  return (
    <div className="space-y-8">
      {/* Birthday Banner (Shown if today is user's birthday) */}
      <BirthdayBanner />

      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Admin Dashboard</h1>
        <p className="text-surface-500 mt-1">Organization overview and analytics</p>
      </div>


      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon="👥" label="Total Employees" value={stats.totalEmployees} color="primary" />
        <StatCard icon="✅" label="Present Today" value={stats.presentToday} color="emerald" />
        <StatCard icon="📋" label="Pending Leaves" value={stats.pendingLeaves} color="amber" />
        <StatCard icon="💰" label="Payroll This Month" value={`₹${stats.payrollThisMonth.toLocaleString()}`} color="cyan" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Pie Chart */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-bold text-surface-100 mb-4">Today's Attendance</h2>
          {attendanceDist.some((d) => d.value > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {attendanceDist.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-500">No attendance data for today</div>
          )}
          <div className="flex justify-center gap-6 mt-2">
            {attendanceDist.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-surface-400">{d.name}: <strong className="text-surface-200">{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Salary Bar Chart */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-bold text-surface-100 mb-4">Department-wise Salary Expense</h2>
          {deptSalary.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptSalary} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    formatter={(value) => [`₹${value.toLocaleString()}`, 'Salary']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                    }}
                  />
                  <Bar dataKey="salary" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-500">No payroll data available</div>
          )}
        </div>
      </div>

      {/* ── Pending Early Check-outs ───────────────────────────────────── */}
      <div className="glass-card p-6 md:col-span-2 mt-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-6">Pending Early Check-outs</h2>
        {pendingEarlyCheckouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-surface-400">
            <span className="text-4xl mb-3">✅</span>
            <p>No pending early check-out requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingEarlyCheckouts.map(req => (
              <div key={req._id} className="p-4 rounded-xl bg-surface-800/30 border border-surface-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-surface-200">{req.employeeId?.name || 'Employee'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">{req.earlyCheckoutStatus.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-surface-400">
                    <span className="text-surface-300 font-medium">Reason: </span>
                    {req.earlyCheckoutReason}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {req.earlyCheckoutStatus === 'Pending_TL' ? (
                    <button onClick={() => handleReviewEarlyCheckout(req._id, 'Pending_PM')} className="btn-success py-1.5 px-3 text-xs">
                      TL Approve
                    </button>
                  ) : (
                    <button onClick={() => handleReviewEarlyCheckout(req._id, 'Approved')} className="btn-success py-1.5 px-3 text-xs">
                      PM Approve
                    </button>
                  )}
                  <button onClick={() => handleReviewEarlyCheckout(req._id, 'Rejected')} className="btn-danger py-1.5 px-3 text-xs">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Pending Face Resets ───────────────────────────────────── */}
      <div className="glass-card p-6 md:col-span-2 mt-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-6">Pending Face Reset Requests</h2>
        {pendingFaceResets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-surface-400">
            <span className="text-4xl mb-3">✅</span>
            <p>No pending face reset requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingFaceResets.map(req => (
              <div key={req._id} className="p-4 rounded-xl bg-surface-800/30 border border-surface-700/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-surface-200">{req.name || 'Employee'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Pending</span>
                  </div>
                  <p className="text-sm text-surface-400">
                    <span className="text-surface-300 font-medium">Employee Code: </span>
                    {req.employeeCode}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => handleReviewFaceReset(req._id, 'Approved')} className="btn-success py-1.5 px-3 text-xs">
                    Approve Reset
                  </button>
                  <button onClick={() => handleReviewFaceReset(req._id, 'Rejected')} className="btn-danger py-1.5 px-3 text-xs">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineShieldCheck, HiOutlineCurrencyRupee, HiOutlineArrowRight } from 'react-icons/hi';
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
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [financeStats, setFinanceStats] = useState({ totalBasic: 0, totalNet: 0, totalPf: 0, totalMediclaim: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      const [employeesRes, todayAttendanceRes, leavesRes, payrollRes, earlyCheckoutRes, withdrawalsRes] = await Promise.all([
        API.get('/auth/employees'),
        API.get(`/attendance/all?date=${today}`),
        API.get('/leaves/all-requests?status=Pending'),
        API.get(`/payroll/all?monthYear=${monthYear}`),
        API.get('/attendance/early-checkout/pending').catch(() => ({ data: [] })),
        API.get('/withdrawals/all').catch(() => ({ data: [] })),
      ]);

      const employees = employeesRes.data;
      const todayAtt = todayAttendanceRes.data;
      setPendingEarlyCheckouts(earlyCheckoutRes.data);
      setPendingFaceResets(employees.filter(e => e.faceResetRequest === 'Pending'));
      setPendingWithdrawals(withdrawalsRes.data.filter(w => w.status === 'Pending'));

      // Financial overview
      let totalBasic = 0, totalNet = 0, totalPf = 0, totalMediclaim = 0;
      employees.forEach(e => {
        const bs  = e.basicSalary || 0;
        const pf  = e.pfAmount || 0;
        const mc  = e.mediclaimAmount || 0;
        totalBasic     += bs;
        totalNet       += (bs - pf - mc);
        totalPf        += e.totalPfAccumulated || 0;
        totalMediclaim += e.totalMediclaimAccumulated || 0;
      });
      setFinanceStats({ totalBasic, totalNet, totalPf, totalMediclaim });

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

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon="💼" label="Total Basic Salary" value={`₹${financeStats.totalBasic.toLocaleString()}`} color="primary" />
        <StatCard icon="💸" label="Total Net Salary" value={`₹${financeStats.totalNet.toLocaleString()}`} color="emerald" />
        <Link to="/admin/pf-withdrawals" className="block transform hover:-translate-y-1 transition-transform group">
          <StatCard icon="🏦" label="Total PF Fund (View Requests ➔)" value={`₹${financeStats.totalPf.toLocaleString()}`} color="amber" />
        </Link>
        <Link to="/admin/mediclaim-requests" className="block transform hover:-translate-y-1 transition-transform group">
          <StatCard icon="🏥" label="Total Mediclaim Fund (View Claims ➔)" value={`₹${financeStats.totalMediclaim.toLocaleString()}`} color="cyan" />
        </Link>
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
                  <Bar dataKey="salary" fill="#0d9488" radius={[8, 8, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-surface-500">No payroll data available</div>
          )}
        </div>
      </div>

      {/* ── Pending Mediclaim & PF Withdrawal Requests ────────────────── */}
      <div className="glass-card p-6 md:col-span-2 mt-6 border-l-4 border-teal-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <HiOutlineShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                Pending Mediclaim &amp; PF Withdrawal Requests
                {pendingWithdrawals.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                    {pendingWithdrawals.length} New
                  </span>
                )}
              </h2>
              <p className="text-xs text-surface-400">Employee medical emergency claims and provident fund withdrawals</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/mediclaim-requests"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 transition-colors flex items-center gap-1"
            >
              Mediclaim Portal <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/admin/pf-withdrawals"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1"
            >
              PF Portal <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {pendingWithdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-surface-400 bg-surface-800/30 rounded-xl border border-surface-700/40">
            <span className="text-3xl mb-2">🎉</span>
            <p className="text-sm font-medium text-surface-300">No pending Mediclaim or PF requests.</p>
            <p className="text-xs text-surface-500 mt-0.5">All employee benefit disbursement claims are fully settled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingWithdrawals.slice(0, 5).map((req) => {
              const isMediclaim = req.type === 'Mediclaim';
              const emp = req.employeeId || {};
              const linkUrl = isMediclaim ? '/admin/mediclaim-requests' : '/admin/pf-withdrawals';

              return (
                <div
                  key={req._id}
                  className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/50 hover:border-surface-600 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`p-2.5 rounded-xl flex-shrink-0 ${
                        isMediclaim
                          ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isMediclaim ? (
                        <HiOutlineShieldCheck className="w-5 h-5" />
                      ) : (
                        <HiOutlineCurrencyRupee className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-surface-100">{emp.name || 'Employee'}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-800 text-surface-400 border border-surface-700">
                          {emp.employeeCode || 'N/A'}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            isMediclaim
                              ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {req.type}
                        </span>
                        <span className="text-xs font-mono text-cyan-400">
                          ID: {isMediclaim ? (req.mediclaimId || emp.mediclaimId) : (req.pfId || emp.pfId)}
                        </span>
                      </div>
                      <p className="text-xs text-surface-300">
                        <strong className="text-emerald-400 font-mono font-bold text-sm">
                          ₹{req.amount?.toLocaleString('en-IN')}
                        </strong>{' '}
                        • Reason: <span className="text-surface-200">{req.reason || req.diseaseName || 'Emergency'}</span>
                        {req.purpose && <span className="text-surface-400 ml-1">[{req.purpose}]</span>}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={linkUrl}
                    className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    Review &amp; Settle <HiOutlineArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
            {pendingWithdrawals.length > 5 && (
              <div className="text-center pt-2">
                <Link
                  to="/admin/withdrawals"
                  className="text-xs text-teal-400 hover:text-teal-300 font-semibold underline"
                >
                  View all {pendingWithdrawals.length} pending claims &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
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

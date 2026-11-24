import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineCash,
  HiOutlineOfficeBuilding,
  HiOutlineDownload,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineRefresh,
} from 'react-icons/hi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    expiringSoonSubscriptions: 0,
    expiredSubscriptions: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/subscription/revenue-stats');
      if (data.stats) setStats(data.stats);
      if (data.revenueChartData) setChartData(data.revenueChartData);
    } catch (error) {
      console.error('Fetch Stats Error:', error);
      toast.error('Failed to load revenue statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true);
    try {
      const response = await API.get('/subscription/export-excel', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Subscriptions_Revenue_Report_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Subscription & Revenue Data Sheet downloaded! 📊');
    } catch (error) {
      console.error('Excel Download Error:', error);
      toast.error('Failed to download spreadsheet');
    } finally {
      setDownloadingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title & Download Data Sheet Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-black text-surface-100">
            Platform Revenue &amp; Financial Analytics
          </h2>
          <p className="text-xs sm:text-sm text-surface-400 mt-1">
            Real-time corporate subscription cash flow, renewal rates, and tenant metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-100 transition-colors"
            title="Refresh"
          >
            <HiOutlineRefresh className="w-5 h-5" />
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs sm:text-sm disabled:opacity-60 cursor-pointer"
          >
            {downloadingExcel ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <HiOutlineDownload className="w-4 h-4" />
            )}
            <span>Download Revenue Data Sheet (Excel)</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Monthly Revenue */}
        <div className="liquid-glass p-6 rounded-3xl border border-teal-500/30 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Monthly Cash Inflow</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-300">
              <HiOutlineCash className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-black text-surface-100 mt-2">
            ₹{stats.monthlyRevenue?.toLocaleString()}
          </h3>
          <p className="text-[11px] text-surface-400 mt-1">Collected in current calendar month</p>
        </div>

        {/* Yearly Revenue */}
        <div className="liquid-glass p-6 rounded-3xl border border-emerald-500/30 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Yearly Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-300">
              <HiOutlineCash className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-black text-emerald-400 mt-2">
            ₹{stats.yearlyRevenue?.toLocaleString()}
          </h3>
          <p className="text-[11px] text-surface-400 mt-1">Total revenue collected this year</p>
        </div>

        {/* Lifetime Revenue */}
        <div className="liquid-glass p-6 rounded-3xl border border-amber-500/30 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">All-Time Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-300">
              👑
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-black text-amber-300 mt-2">
            ₹{stats.totalRevenue?.toLocaleString()}
          </h3>
          <p className="text-[11px] text-surface-400 mt-1">Cumulative platform gross receipts</p>
        </div>

        {/* Subscribed Enterprises */}
        <div className="liquid-glass p-6 rounded-3xl border border-purple-500/30 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Subscribed Companies</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-300">
              <HiOutlineOfficeBuilding className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-display font-black text-surface-100 mt-2">
            {stats.totalSubscriptions}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-[11px]">
            <span className="text-emerald-400 font-bold">{stats.activeSubscriptions} Active</span>
            <span className="text-surface-600">•</span>
            <span className="text-amber-400 font-bold">{stats.expiringSoonSubscriptions} Warning</span>
          </div>
        </div>
      </div>

      {/* Revenue Trend Visualizer Chart */}
      <div className="liquid-glass p-6 sm:p-8 rounded-3xl border border-surface-800 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-surface-100">Monthly Revenue Trajectory</h3>
            <p className="text-xs text-surface-400 mt-0.5">Recurring subscription inflows across recent billing periods</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
            INR (₹)
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b1920',
                  borderColor: '#14b8a6',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                formatter={(val) => [`₹${val.toLocaleString()}`, 'Revenue Inflow']}
              />
              <Bar dataKey="revenue" fill="#0d9488" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

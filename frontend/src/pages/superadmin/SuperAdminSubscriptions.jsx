import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineSearch,
  HiOutlineOfficeBuilding,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineClock,
  HiOutlineRefresh,
} from 'react-icons/hi';

const SuperAdminSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/subscription/all?status=${statusFilter}&search=${search}`);
      if (data.subscriptions) setSubscriptions(data.subscriptions);
    } catch (error) {
      console.error('Fetch Subscriptions Error:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchSubscriptions();
  };

  const getStatusBadge = (status, daysRemaining) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Active ({daysRemaining}d left)
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            Warning ({daysRemaining}d left)
          </span>
        );
      case 'grace_period':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
            Grace Period ({daysRemaining}d)
          </span>
        );
      case 'expired':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Expired &amp; Locked
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-800 text-surface-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-black text-surface-100">
            Subscribed Organizations &amp; Companies
          </h2>
          <p className="text-xs sm:text-sm text-surface-400 mt-1">
            Complete registry of enterprise subscriptions, payment references, and renewal history
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, admin, email..."
              className="input-field text-xs h-10 w-64 pr-8 bg-surface-900/60"
            />
            <button
              type="submit"
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-surface-400 hover:text-surface-100"
            >
              <HiOutlineSearch className="w-4 h-4" />
            </button>
          </form>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field text-xs h-10 w-auto bg-surface-900/60"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon (5d)</option>
            <option value="grace_period">Grace Period</option>
            <option value="expired">Expired</option>
          </select>

          <button
            onClick={fetchSubscriptions}
            className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-100 transition-colors"
            title="Refresh list"
          >
            <HiOutlineRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="liquid-glass rounded-3xl shadow-xl overflow-hidden">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Admin Contact</th>
                <th>Plan Type</th>
                <th>Amount Paid</th>
                <th>Start Date</th>
                <th>Expiry Date</th>
                <th>Days Remaining</th>
                <th>Status</th>
                <th>Renewals</th>
                <th>Payment Ref</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-surface-400 text-xs">
                    No subscriptions found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => {
                  const daysLeft = sub.daysRemaining;
                  const renewalCount = sub.history?.length || 1;
                  return (
                    <tr key={sub._id} className="hover:bg-surface-800/40 transition-colors text-xs">
                      <td className="font-bold text-surface-100">
                        <div className="flex items-center gap-2">
                          <HiOutlineOfficeBuilding className="w-4 h-4 text-teal-400 flex-shrink-0" />
                          <span>{sub.companyName || 'Corporate Tenant'}</span>
                        </div>
                      </td>

                      <td>
                        <div className="font-semibold text-surface-200">{sub.adminName}</div>
                        <div className="text-[11px] text-surface-400">{sub.adminEmail}</div>
                        {sub.adminPhone && (
                          <div className="text-[10px] text-surface-500">{sub.adminPhone}</div>
                        )}
                      </td>

                      <td className="font-bold text-teal-300">
                        {sub.planName}
                      </td>

                      <td className="font-mono font-bold text-emerald-400">
                        ₹{sub.amount?.toLocaleString()}
                      </td>

                      <td className="text-surface-300 whitespace-nowrap">
                        {new Date(sub.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      <td className="text-surface-300 whitespace-nowrap">
                        {new Date(sub.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      <td className="font-mono font-bold">
                        {daysLeft > 0 ? (
                          <span className={daysLeft <= 5 ? 'text-amber-400' : 'text-emerald-400'}>
                            {daysLeft} days
                          </span>
                        ) : (
                          <span className="text-rose-400">Overdue ({daysLeft}d)</span>
                        )}
                      </td>

                      <td>
                        {getStatusBadge(sub.status, daysLeft)}
                      </td>

                      <td className="text-center font-bold text-surface-300">
                        {renewalCount}
                      </td>

                      <td className="font-mono text-[10px] text-surface-400 max-w-[130px] truncate" title={sub.razorpayPaymentId}>
                        {sub.razorpayPaymentId || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSubscriptions;

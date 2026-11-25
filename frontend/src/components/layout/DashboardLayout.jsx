import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/axios';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import RenewModal from '../subscription/RenewModal';

const ADMIN_ROLES = [
  'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
  'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subStatus, setSubStatus] = useState(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (ADMIN_ROLES.includes(user?.role)) {
      API.get('/subscription/my-status')
        .then(({ data }) => {
          if (data.hasSubscription) setSubStatus(data);
        })
        .catch(() => {});
    }
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* 5-Day Expiration / Grace Period / Expired Urgent Banner */}
        {subStatus && (subStatus.isExpiringSoon || subStatus.isGracePeriod || subStatus.isExpired) && (
          <div className="bg-gradient-to-r from-amber-950/90 via-red-950/80 to-amber-950/90 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="text-base animate-bounce">⚠️</span>
              <span>
                <strong>Subscription Alert:</strong>{' '}
                {subStatus.isExpired ? (
                  <>
                    Your corporate subscription has <strong className="text-rose-300">expired</strong>. Team access is paused until you renew. All data remains safe.
                  </>
                ) : (
                  <>
                    Your plan expires in{' '}
                    <strong className="text-white font-mono">
                      {subStatus.daysRemaining > 0 ? `${subStatus.daysRemaining} days` : '0 days (Grace Period Active)'}
                    </strong>
                    . Renew today to keep your workspace and team running with zero interruption.
                  </>
                )}
              </span>
            </div>
            <button
              onClick={() => setShowRenewModal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap ml-3"
            >
              Renew Plan ⚡
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Renewal Modal */}
      <RenewModal
        isOpen={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        currentSub={subStatus}
        onRenewed={(updated) => setSubStatus((prev) => ({ ...prev, ...updated, isExpiringSoon: false, isGracePeriod: false, isExpired: false }))}
      />
    </div>
  );
};

export default DashboardLayout;

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
    <div className="relative flex h-screen overflow-hidden bg-surface-950 transition-colors duration-300">
      {/* Ambient Liquid Glass Refraction Orbs behind Sidebar & Workspace */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#D2F801]/25 dark:bg-[#D2F801]/16 blur-3xl" />
        <div className="absolute top-1/2 -left-16 w-72 h-72 rounded-full bg-teal-400/20 dark:bg-[#A6EB00]/12 blur-3xl" />
        <div className="absolute -bottom-24 left-10 w-72 h-72 rounded-full bg-[#D2F801]/20 dark:bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* 5-Day Expiration / Grace Period / Expired Urgent Banner */}
        {subStatus && (subStatus.isExpiringSoon || subStatus.isGracePeriod || subStatus.isExpired) && (
          <div className="bg-[#0B0D11] border-b border-[#D2F801]/50 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap text-xs text-white shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="text-base animate-bounce">⚠️</span>
              <span>
                <strong>Subscription Alert:</strong>{' '}
                {subStatus.isExpired ? (
                  <>
                    Your corporate subscription has <strong className="text-rose-400">expired</strong>. Team access is paused until you renew. All data remains safe.
                  </>
                ) : (
                  <>
                    Your plan expires in{' '}
                    <strong className="text-[#D2F801] font-mono">
                      {subStatus.daysRemaining > 0 ? `${subStatus.daysRemaining} days` : '0 days (Grace Period Active)'}
                    </strong>
                    . Renew today to keep your workspace and team running with zero interruption.
                  </>
                )}
              </span>
            </div>
            <button
              onClick={() => setShowRenewModal(true)}
              className="px-4 py-1.5 bg-[#D2F801] hover:bg-[#DCFF26] text-[#0B0D11] font-extrabold rounded-full shadow-md transition-all cursor-pointer whitespace-nowrap"
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

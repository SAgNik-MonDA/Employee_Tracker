import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { HiOutlineMenuAlt2, HiOutlineLogout, HiOutlineSun, HiOutlineMoon } from 'react-icons/hi';
import UserAvatar from '../common/UserAvatar';
import NotificationDropdown from '../common/NotificationDropdown';
import toast from 'react-hot-toast';

const Topbar = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [subStatus, setSubStatus] = useState(null);

  const ADMIN_ROLES = [
    'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
    'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
  ];

  useEffect(() => {
    if (ADMIN_ROLES.includes(user?.role)) {
      API.get('/subscription/my-status')
        .then(({ data }) => {
          if (data.hasSubscription) setSubStatus(data);
        })
        .catch(() => {});
    }
  }, [user]);
  const profilePath = ADMIN_ROLES.includes(user?.role)
    ? '/admin/profile'
    : '/employee/profile';

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';

  return (
    <header className="sticky top-0 z-30 bg-surface-900/85 dark:bg-surface-900/85 backdrop-blur-xl border-b border-surface-700/50 light:bg-white/90 light:border-surface-200/80 transition-colors">
      <div className="flex items-center justify-between px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
        {/* Left Section: Menu Toggle, Avatar & Welcome greeting */}
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-surface-700/40 text-surface-300 hover:text-surface-100 transition-all flex-shrink-0 active:scale-95"
            aria-label="Open sidebar menu"
          >
            <HiOutlineMenuAlt2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div
            onClick={() => navigate(profilePath)}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0"
            title="Go to My Profile"
          >
            <UserAvatar
              user={user}
              size="sm"
              className="flex-shrink-0 group-hover:ring-2 group-hover:ring-teal-400/50 transition-all shadow-sm"
            />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-display font-bold text-surface-100 truncate group-hover:text-teal-300 transition-colors flex items-center gap-1">
                <span className="hidden sm:inline">Welcome back, </span>
                <span className="truncate">{firstName}</span>
                <span className="select-none flex-shrink-0">👋</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-surface-400 hidden sm:block whitespace-nowrap truncate">
                {todayStr}
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Badges & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Subscription Status Pill for Admin */}
          {subStatus && (
            <span
              className={`hidden lg:inline-flex badge border text-xs font-semibold whitespace-nowrap cursor-default ${
                subStatus.daysRemaining > 5
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : subStatus.daysRemaining > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
              title={`Subscription active until ${new Date(subStatus.endDate).toLocaleDateString()}`}
            >
              {subStatus.daysRemaining > 5
                ? `⭐ ${subStatus.planName} (${subStatus.daysRemaining}d left)`
                : subStatus.daysRemaining > 0
                ? `⚠️ Expiring in ${subStatus.daysRemaining}d`
                : '🚨 Grace Period'}
            </span>
          )}

          {/* Role Badge (Visible on md and up, so long role names don't break mobile) */}
          {user?.role && (
            <span
              className={`hidden md:inline-flex badge border text-xs whitespace-nowrap ${
                roleBadgeColors[user?.role] || 'bg-surface-800/80 text-surface-300 border-surface-700/60'
              }`}
            >
              {user.role}
            </span>
          )}

          {/* Employee Code (Visible on sm and up) */}
          {user?.employeeCode && (
            <span
              className="hidden sm:inline-flex badge border text-xs bg-teal-500/15 text-teal-300 border-teal-500/30 font-mono font-semibold whitespace-nowrap"
              title="Employee Code"
            >
              {user.employeeCode}
            </span>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-surface-700/40 text-surface-400 hover:text-surface-200 transition-all duration-200 active:scale-95 flex-shrink-0"
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="relative w-5 h-5">
              <HiOutlineSun
                className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
                  theme === 'dark' ? 'rotate-0 scale-100 opacity-100 text-amber-300' : '-rotate-90 scale-0 opacity-0'
                }`}
              />
              <HiOutlineMoon
                className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
                  theme === 'light' ? 'rotate-0 scale-100 opacity-100 text-teal-600' : 'rotate-90 scale-0 opacity-0'
                }`}
              />
            </div>
          </button>

          {/* Notifications Dropdown */}
          <NotificationDropdown />

          {/* Logout Button (Icon on mobile, Icon + Text on tablet/desktop) */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-surface-800/40 hover:bg-rose-500/15 border border-surface-700/40 hover:border-rose-500/30 text-surface-400 hover:text-rose-400 transition-all duration-200 flex-shrink-0 active:scale-95"
            title="Logout"
          >
            <HiOutlineLogout className="w-4 h-4 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline text-xs font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;

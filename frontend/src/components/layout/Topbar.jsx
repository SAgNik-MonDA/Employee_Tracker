import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { HiOutlineMenuAlt2, HiOutlineLogout, HiOutlineSun, HiOutlineMoon } from 'react-icons/hi';
import UserAvatar from '../common/UserAvatar';
import NotificationDropdown from '../common/NotificationDropdown';
import toast from 'react-hot-toast';

const Topbar = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const roleBadgeColors = {
    Admin: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    HR: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    Employee: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <header className="sticky top-0 z-30 bg-surface-900/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-700/50 light:bg-white/80 light:border-surface-200">
      <div className="flex items-center justify-between px-4 lg:px-8 py-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl hover:bg-surface-800 text-surface-400 transition-colors"
          >
            <HiOutlineMenuAlt2 className="w-6 h-6" />
          </button>
          <UserAvatar user={user} size="sm" />
          <div>
            <h2 className="text-lg font-display font-bold text-surface-100 dark:text-surface-100">
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h2>
            <p className="text-xs text-surface-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={`badge border text-xs ${roleBadgeColors[user?.role] || 'bg-surface-800 text-surface-300 border-surface-700'}`}>
            {user?.role}
          </span>
          {user?.employeeCode && (
            <span className="badge border text-xs bg-indigo-500/15 text-indigo-300 border-indigo-500/30 font-mono font-semibold" title="Employee Code">
              {user.employeeCode}
            </span>
          )}
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-all duration-300 relative group"
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="relative w-5 h-5">
              <HiOutlineSun className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
                theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
              }`} />
              <HiOutlineMoon className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
                theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
              }`} />
            </div>
          </button>

          <NotificationDropdown />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-700/50
                       hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400
                       text-surface-400 text-sm font-medium transition-all duration-300"
          >
            <HiOutlineLogout className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import {
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineX,
  HiOutlineCalendar,
  HiOutlineCurrencyRupee,
  HiOutlineChartBar,
  HiOutlineClipboardCheck,
  HiOutlineClock,
  HiOutlineArchive,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
} from 'react-icons/hi';

const typeConfig = {
  leave_applied: {
    icon: <HiOutlineCalendar className="w-5 h-5" />,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  leave_approved: {
    icon: <HiOutlineClipboardCheck className="w-5 h-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  leave_rejected: {
    icon: <HiOutlineClipboardCheck className="w-5 h-5" />,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  payroll_generated: {
    icon: <HiOutlineCurrencyRupee className="w-5 h-5" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  performance_reviewed: {
    icon: <HiOutlineChartBar className="w-5 h-5" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  team_expiry_warning: {
    icon: <HiOutlineClock className="w-5 h-5" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  team_auto_archived: {
    icon: <HiOutlineArchive className="w-5 h-5" />,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  early_checkout_requested: {
    icon: <HiOutlineClock className="w-5 h-5" />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  early_checkout_approved: {
    icon: <HiOutlineClock className="w-5 h-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  early_checkout_rejected: {
    icon: <HiOutlineClock className="w-5 h-5" />,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  face_reset_requested: {
    icon: <HiOutlineShieldCheck className="w-5 h-5" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  face_reset_approved: {
    icon: <HiOutlineShieldCheck className="w-5 h-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  face_reset_rejected: {
    icon: <HiOutlineShieldCheck className="w-5 h-5" />,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  general_request_submitted: {
    icon: <HiOutlineDocumentText className="w-5 h-5" />,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  general_request_reviewed: {
    icon: <HiOutlineDocumentText className="w-5 h-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
};

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const NotificationDropdown = () => {
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } =
    useNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (!open) fetchNotifications();
    setOpen((prev) => !prev);
  };

  const handleClick = async (notif) => {
    if (!notif.isRead) await markRead(notif._id);
    setOpen(false);
    if (notif.link && user) {
      const isAdmin = ['Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'].includes(user.role);
      const basePath = isAdmin ? '/admin' : '/employee';
      
      let link = notif.link;
      if (link.startsWith('/employee')) link = link.replace('/employee', '');
      if (link.startsWith('/admin')) link = link.replace('/admin', '');
      
      // Compatibility fix for old notifications in DB
      if ((notif.type === 'leave_approved' || notif.type === 'leave_rejected') && !link.includes('#leave-history')) {
        link += '#leave-history';
      }
      
      navigate(`${basePath}${link}`);
    }
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    await markAllRead();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={handleOpen}
        className="p-2.5 rounded-xl hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-all duration-200 relative"
        aria-label="Notifications"
      >
        <HiOutlineBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-primary-500/40 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="notification-dropdown"
          className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] flex flex-col
                     bg-surface-900/95 backdrop-blur-xl border border-surface-700/60
                     rounded-2xl shadow-2xl shadow-black/50 z-50
                     animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <HiOutlineBell className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-semibold text-surface-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary-500/20 text-primary-400 text-[10px] font-bold rounded-full border border-primary-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-surface-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all duration-200"
                  title="Mark all as read"
                >
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-700/50 text-surface-500 hover:text-surface-300 transition-colors"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1 divide-y divide-surface-800/60">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-800 flex items-center justify-center">
                  <HiOutlineBell className="w-6 h-6 text-surface-600" />
                </div>
                <p className="text-sm text-surface-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const cfg = typeConfig[notif.type] || typeConfig.leave_applied;
                return (
                  <button
                    key={notif._id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all duration-200
                                hover:bg-surface-800/60 group
                                ${!notif.isRead ? 'bg-surface-800/30' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${!notif.isRead ? 'text-surface-100' : 'text-surface-300'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-surface-600 flex-shrink-0 mt-0.5">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-surface-500 mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5 shadow-sm shadow-primary-500/50" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-surface-700/50 flex-shrink-0">
              <p className="text-[11px] text-surface-600 text-center">
                Showing latest {notifications.length} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

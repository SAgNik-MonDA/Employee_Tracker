import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import toast from 'react-hot-toast';
import {
  HiOutlineChartPie,
  HiOutlineOfficeBuilding,
  HiOutlineTemplate,
  HiOutlineMail,
  HiOutlineLogout,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineMenuAlt2,
  HiOutlineShieldCheck,
  HiOutlineX,
} from 'react-icons/hi';

const SuperAdminLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('SuperAdmin logged out');
    navigate('/login');
  };

  const navItems = [
    { name: 'Revenue & Analytics', path: '/superadmin/dashboard', icon: <HiOutlineChartPie className="w-5 h-5" /> },
    { name: 'Subscribed Companies', path: '/superadmin/subscriptions', icon: <HiOutlineOfficeBuilding className="w-5 h-5" /> },
    { name: 'Landing Page CMS', path: '/superadmin/cms', icon: <HiOutlineTemplate className="w-5 h-5" /> },
    { name: 'Contact Inquiries', path: '/superadmin/inquiries', icon: <HiOutlineMail className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 text-surface-100 transition-colors">
      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-surface-900 border-r border-surface-800/80 flex flex-col justify-between transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Logo & Header */}
          <div className="p-6 flex items-center justify-between border-b border-surface-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-950/40">
                👑
              </div>
              <div>
                <h1 className="font-display font-extrabold text-base tracking-tight text-surface-100 flex items-center gap-1.5">
                  <span>SuperAdmin</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Master
                  </span>
                </h1>
                <p className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">
                  Platform Governance
                </p>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-xl text-surface-400 hover:text-surface-100"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>

          {/* Privacy Notice Reminder */}
          <div className="mx-4 my-4 p-3 bg-teal-950/40 border border-teal-500/30 rounded-2xl flex items-start gap-2.5 text-[11px] text-teal-200">
            <HiOutlineShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Tenant Privacy Active:</strong> SuperAdmin has zero access to individual corporate employee profiles, payroll, or biometric data.
            </span>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-950/30'
                      : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/60'
                  }`
                }
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-surface-800">
          <div className="flex items-center justify-between mb-3 px-2">
            <div>
              <p className="text-xs font-bold text-surface-200">{user?.name || 'SuperAdmin'}</p>
              <p className="text-[10px] text-surface-500 truncate max-w-[150px]">{user?.email}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-surface-800 text-surface-300 hover:text-surface-100"
            >
              {theme === 'dark' ? <HiOutlineSun className="w-4 h-4 text-amber-300" /> : <HiOutlineMoon className="w-4 h-4 text-teal-500" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-800/80 hover:bg-rose-950/50 hover:text-rose-400 text-surface-300 font-bold text-xs transition-colors border border-surface-700/60"
          >
            <HiOutlineLogout className="w-4 h-4" />
            <span>Sign Out Master</span>
          </button>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-surface-900/80 backdrop-blur-xl border-b border-surface-800/80 flex items-center justify-between px-4 sm:px-8">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-surface-800 text-surface-300"
          >
            <HiOutlineMenuAlt2 className="w-5 h-5" />
          </button>
          <div className="hidden sm:block text-xs font-semibold text-surface-400">
            System Operations Control Center
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400">Master Governance Live</span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;

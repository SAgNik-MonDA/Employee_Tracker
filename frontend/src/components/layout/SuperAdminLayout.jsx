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
    <div className="relative flex h-screen overflow-hidden bg-surface-950 text-surface-100 transition-colors">
      {/* Ambient Liquid Glass Refraction Orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#D2F801]/25 dark:bg-[#D2F801]/16 blur-3xl" />
        <div className="absolute top-1/2 -left-16 w-72 h-72 rounded-full bg-teal-400/20 dark:bg-[#A6EB00]/12 blur-3xl" />
        <div className="absolute -bottom-24 left-12 w-72 h-72 rounded-full bg-[#D2F801]/20 dark:bg-emerald-500/10 blur-3xl" />
      </div>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-20 w-72 sidebar-liquid-glass overflow-hidden flex flex-col justify-between transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Logo & Header */}
          <div className="p-6 flex items-center justify-between border-b border-neutral-200 dark:border-[#242934]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0F1115] dark:bg-[#D2F801] flex items-center justify-center text-[#D2F801] dark:text-[#0B0D11] font-black shadow-md">
                👑
              </div>
              <div>
                <h1 className="font-display font-extrabold text-base tracking-tight text-surface-100 flex items-center gap-1.5">
                  <span>SuperAdmin</span>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#D2F801] text-[#0B0D11]">
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
          <div className="mx-4 my-4 p-3 bg-white/55 dark:bg-white/[0.04] backdrop-blur-md border border-[#84B800]/55 dark:border-[#BEEB00]/55 rounded-2xl flex items-start gap-2.5 text-[11px] text-surface-200 shadow-sm">
            <HiOutlineShieldCheck className="w-4 h-4 text-[#3F5C00] dark:text-[#D2F801] flex-shrink-0 mt-0.5" />
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
                      ? 'bg-[#0F1115] dark:bg-[#D2F801] text-white dark:text-[#0B0D11] shadow-md'
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
        <div className="p-4 border-t border-neutral-200/60 dark:border-[#D2F801]/20 bg-white/40 dark:bg-white/[0.03] backdrop-blur-md">
          <div className="flex items-center justify-between mb-3 px-2">
            <div>
              <p className="text-xs font-bold text-surface-100">{user?.name || 'SuperAdmin'}</p>
              <p className="text-[10px] text-surface-400 truncate max-w-[150px]">{user?.email}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-surface-800 border border-surface-700 text-surface-100 hover:border-[#D2F801]"
            >
              {theme === 'dark' ? <HiOutlineSun className="w-4 h-4 text-[#D2F801]" /> : <HiOutlineMoon className="w-4 h-4 text-[#0F1115]" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-surface-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-surface-200 font-bold text-xs transition-colors border border-surface-700"
          >
            <HiOutlineLogout className="w-4 h-4" />
            <span>Sign Out Master</span>
          </button>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white/90 dark:bg-[#0E1015]/90 backdrop-blur-xl border-b border-neutral-200 dark:border-[#242934] flex items-center justify-between px-4 sm:px-8">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-200"
          >
            <HiOutlineMenuAlt2 className="w-5 h-5" />
          </button>
          <div className="hidden sm:block text-xs font-semibold text-surface-400">
            System Operations Control Center
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#D2F801] text-[#0B0D11]">
            <span className="w-2 h-2 rounded-full bg-[#0B0D11] animate-pulse" />
            <span className="text-xs font-extrabold">Master Governance Live</span>
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

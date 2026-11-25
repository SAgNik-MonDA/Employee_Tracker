import { NavLink, Link } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../common/UserAvatar';
import {
  HiOutlineHome,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineCurrencyRupee,
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineClipboardCheck,
  HiOutlineUser,
  HiOutlineVideoCamera,
  HiOutlineShieldCheck,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineChevronRight,
} from 'react-icons/hi';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  const employeeLinks = [
    { to: '/employee/dashboard',   icon: <HiOutlineHome />,          label: 'Dashboard' },
    { to: '/employee/teams',       icon: <HiOutlineUsers />,         label: 'Teams' },
    { to: '/employee/meetings',    icon: <HiOutlineVideoCamera />,   label: 'Meetings & MOM' },
    { to: '/employee/attendance',  icon: <HiOutlineClock />,         label: 'My Attendance' },
    { to: '/employee/leaves',      icon: <HiOutlineCalendar />,      label: 'Apply Leave' },
    { to: '/employee/requests',    icon: <HiOutlineDocumentText />,   label: 'My Requests' },
    { to: '/employee/mediclaim',   icon: <HiOutlineShieldCheck />,    label: 'Mediclaim & PF' },
    { to: '/employee/shifts',      icon: <HiOutlineClock />,         label: 'My Shifts' },
    { to: '/employee/performance', icon: <HiOutlineChartBar />,      label: 'My Performance' },
    { to: '/employee/payslips',    icon: <HiOutlineCurrencyRupee />, label: 'My Payslips' },
    { to: '/employee/profile',     icon: <HiOutlineUser />,          label: 'My Profile' },
  ];

  // Admin-only links (full access)
  const adminLinks = [
    { to: '/admin/dashboard',    icon: <HiOutlineHome />,          label: 'Dashboard' },
    { to: '/admin/teams',        icon: <HiOutlineUsers />,         label: 'Teams' },
    { to: '/admin/meetings',     icon: <HiOutlineVideoCamera />,   label: 'Meetings & MOM' },
    { to: '/admin/employees',    icon: <HiOutlineUsers />,          label: 'Manage Employees' },
    ...(user?.role === 'Admin'
      ? [{ to: '/admin/recycle-bin', icon: <HiOutlineTrash />,       label: 'Recycle Bin' }]
      : []),
    { to: '/admin/holidays',     icon: <HiOutlineCalendar />,       label: 'Set Holidays' },
    { to: '/admin/shift-schedule', icon: <HiOutlineClock />,        label: 'Shift Schedule' },
    { to: '/admin/attendance',   icon: <HiOutlineClock />,          label: 'Attendance Overview' },
    { to: '/admin/early-checkouts',icon: <HiOutlineClock />,        label: 'Early Check-outs' },
    { to: '/admin/face-resets',  icon: <HiOutlineUser />,           label: 'Face Resets' },
    { to: '/admin/requests',     icon: <HiOutlineDocumentText />,   label: 'Employee Requests' },
    { to: '/admin/leaves',       icon: <HiOutlineClipboardCheck />, label: 'Leave Approvals' },
    { to: '/admin/set-leaves',   icon: <HiOutlineCalendar />,       label: 'Set Leave Quotas' },
    { to: '/admin/performance',  icon: <HiOutlineChartBar />,       label: 'Performance Review' },
    { to: '/admin/payroll',      icon: <HiOutlineDocumentText />,   label: 'Generate Payroll' },
    { to: '/admin/set-salary',   icon: <HiOutlineCurrencyRupee />, label: 'Set Salary' },
    { to: '/admin/mediclaim-requests', icon: <HiOutlineShieldCheck />,  label: 'Mediclaim Requests' },
    { to: '/admin/pf-withdrawals',     icon: <HiOutlineCurrencyRupee />, label: 'PF Withdrawals' },
    { to: '/admin/profile',      icon: <HiOutlineUser />,           label: 'My Profile' },
  ];

  // HR links — employee management (create/edit employees, Recycle Bin restore, leave approvals)
  const hrLinks = [
    { to: '/admin/dashboard',    icon: <HiOutlineHome />,          label: 'Dashboard' },
    { to: '/admin/teams',        icon: <HiOutlineUsers />,         label: 'Teams' },
    { to: '/admin/meetings',     icon: <HiOutlineVideoCamera />,   label: 'Meetings & MOM' },
    { to: '/admin/employees',    icon: <HiOutlineUsers />,          label: 'Manage Employees' },
    { to: '/admin/recycle-bin',  icon: <HiOutlineTrash />,          label: 'Recycle Bin' },
    { to: '/admin/holidays',     icon: <HiOutlineCalendar />,       label: 'Set Holidays' },
    { to: '/admin/shift-schedule', icon: <HiOutlineClock />,        label: 'Shift Schedule' },
    { to: '/admin/attendance',   icon: <HiOutlineClock />,          label: 'Attendance Overview' },
    { to: '/admin/early-checkouts',icon: <HiOutlineClock />,        label: 'Early Check-outs' },
    { to: '/admin/face-resets',  icon: <HiOutlineUser />,           label: 'Face Resets' },
    { to: '/admin/requests',     icon: <HiOutlineDocumentText />,   label: 'Employee Requests' },
    { to: '/admin/leaves',       icon: <HiOutlineClipboardCheck />, label: 'Leave Approvals' },
    { to: '/admin/set-leaves',   icon: <HiOutlineCalendar />,       label: 'Set Leave Quotas' },
    { to: '/admin/my-leave',     icon: <HiOutlineCalendar />,       label: 'Apply Leave' },
    { to: '/admin/performance',  icon: <HiOutlineChartBar />,       label: 'Performance Review' },
    { to: '/admin/payroll',      icon: <HiOutlineDocumentText />,   label: 'View Payroll' },
    { to: '/admin/set-salary',   icon: <HiOutlineCurrencyRupee />, label: 'Set Salary' },
    { to: '/admin/mediclaim-requests', icon: <HiOutlineShieldCheck />,  label: 'Mediclaim Requests' },
    { to: '/admin/pf-withdrawals',     icon: <HiOutlineCurrencyRupee />, label: 'PF Withdrawals' },
    { to: '/admin/profile',      icon: <HiOutlineUser />,           label: 'My Profile' },
  ];


  const ADMIN_ROLES = [
    'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
    'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
  ];

  const links = !ADMIN_ROLES.includes(user?.role) ? employeeLinks
    : user?.role === 'HR' ? hrLinks
    : adminLinks;

  const profilePath = ADMIN_ROLES.includes(user?.role)
    ? '/admin/profile'
    : '/employee/profile';

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-surface-950/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 sidebar-liquid-glass overflow-hidden
                     transform transition-all duration-300 ease-in-out flex flex-col
                     ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:relative lg:z-20`}
      >
        {/* Subtle internal liquid-glass refraction highlight */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full bg-[#D2F801]/18 dark:bg-[#D2F801]/12 blur-2xl" />
          <div className="absolute bottom-24 -left-10 w-36 h-36 rounded-full bg-white/40 dark:bg-white/[0.04] blur-2xl" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-between px-5 py-5 border-b border-neutral-200/60 dark:border-[#D2F801]/20">
          <BrandLogo compact />
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-surface-400"
            aria-label="Close sidebar"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border focus:outline-none
                 ${isActive
                   ? 'bg-[#0F1115] dark:bg-[#D2F801] text-white dark:text-[#0B0D11] border-[#D2F801]/40 shadow-md font-bold'
                   : 'text-surface-400 hover:text-surface-100 hover:bg-white/60 dark:hover:bg-white/[0.07] hover:backdrop-blur-md border-transparent hover:border-[#84B800]/30 dark:hover:border-[#D2F801]/25'
                 }`
              }
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user info — Clickable profile card */}
        <div className="relative z-10 p-3 border-t shrink-0 border-neutral-200/60 dark:border-[#D2F801]/20 bg-white/40 dark:bg-white/[0.03] backdrop-blur-md">
          <Link
            to={profilePath}
            onClick={onClose}
            className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 bg-white/55 dark:bg-white/[0.05] hover:bg-white/80 dark:hover:bg-white/[0.09] group border border-[#84B800]/50 dark:border-[#BEEB00]/45 hover:border-[#6A9600] dark:hover:border-[#D2F801] shadow-sm"
            title="Go to My Profile"
          >
            <UserAvatar user={user} size="sm" className="group-hover:ring-2 group-hover:ring-[#D2F801]/70 transition-all" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-surface-100 group-hover:text-teal-400 transition-colors">
                {user?.name}
              </p>
              <p className="text-xs text-surface-400 truncate group-hover:text-surface-300 transition-colors">
                {user?.designation || user?.role}
              </p>
            </div>
            <HiOutlineChevronRight className="w-4 h-4 text-surface-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

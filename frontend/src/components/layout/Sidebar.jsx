import { NavLink, Link } from 'react-router-dom';
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

  // HR links — full manage access (add/edit employees, leave approvals) but no delete
  const hrLinks = [
    { to: '/admin/dashboard',    icon: <HiOutlineHome />,          label: 'Dashboard' },
    { to: '/admin/teams',        icon: <HiOutlineUsers />,         label: 'Teams' },
    { to: '/admin/meetings',     icon: <HiOutlineVideoCamera />,   label: 'Meetings & MOM' },
    { to: '/admin/employees',    icon: <HiOutlineUsers />,          label: 'Manage Employees' },
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
        className={`fixed top-0 left-0 z-50 h-full w-72 backdrop-blur-xl border-r
                     transform transition-all duration-300 ease-in-out flex flex-col
                     ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto
                     bg-white dark:bg-[#0E1015] border-neutral-200 dark:border-[#242934]`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-[#242934]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0F1115] dark:bg-[#D2F801] flex items-center justify-center shadow-md">
              <span className="text-[#D2F801] dark:text-[#0B0D11] font-display font-extrabold text-lg">
                ET
              </span>
            </div>
            <div>
              <h1 className="font-display font-extrabold text-base text-surface-100 tracking-tight">
                Employee Tracker
              </h1>
              <p className="text-[11px] font-semibold text-[#3F5C00] dark:text-[#D2F801] -mt-0.5 tracking-wider uppercase">
                HR &amp; Finance Suite
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors hover:bg-surface-800 text-surface-400"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border focus:outline-none
                 ${isActive
                   ? 'bg-[#0F1115] dark:bg-[#D2F801] text-white dark:text-[#0B0D11] border-transparent shadow-md font-bold'
                   : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/60 border-transparent'
                 }`
              }
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user info — Clickable profile card */}
        <div className="p-3 border-t shrink-0 border-neutral-200 dark:border-[#242934] bg-white dark:bg-[#0E1015]">
          <Link
            to={profilePath}
            onClick={onClose}
            className="flex items-center gap-3 p-2 rounded-xl transition-all duration-200 hover:bg-surface-800/80 group border border-transparent hover:border-[#D2F801]/50"
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

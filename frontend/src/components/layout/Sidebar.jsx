import { NavLink } from 'react-router-dom';
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
  HiOutlineX,
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
    { to: '/admin/performance',  icon: <HiOutlineChartBar />,       label: 'Performance Review' },
    { to: '/admin/payroll',      icon: <HiOutlineDocumentText />,   label: 'Generate Payroll' },
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
    { to: '/admin/my-leave',     icon: <HiOutlineCalendar />,       label: 'Apply Leave' },
    { to: '/admin/performance',  icon: <HiOutlineChartBar />,       label: 'Performance Review' },
    { to: '/admin/payroll',      icon: <HiOutlineDocumentText />,   label: 'View Payroll' },
    { to: '/admin/profile',      icon: <HiOutlineUser />,           label: 'My Profile' },
  ];


  const ADMIN_ROLES = [
    'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
    'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
  ];

  const links = !ADMIN_ROLES.includes(user?.role) ? employeeLinks
    : user?.role === 'HR' ? hrLinks
    : adminLinks;

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
                     bg-surface-900/95 border-surface-700/50`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <span className="text-white font-bold text-lg">ET</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-surface-100">Employee</h1>
              <p className="text-xs text-surface-500 -mt-0.5">Tracker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg transition-colors hover:bg-surface-700/50 text-surface-400"
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
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40
                 ${isActive
                   ? 'bg-primary-500/15 text-primary-400 border-primary-500/20 shadow-sm'
                   : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 border-transparent'
                 }`
              }
            >
              <span className="text-xl">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom user info */}
        <div className="p-4 border-t shrink-0 border-surface-700/50 bg-surface-900/95">
          <div className="flex items-center gap-3 px-3">
            <UserAvatar user={user} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-surface-200">{user?.name}</p>
              <p className="text-xs text-surface-500 truncate">{user?.designation || user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import LandingPage from './pages/LandingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

import MeetingsPage from './pages/common/MeetingsPage';
import TeamsPage from './pages/common/TeamsPage';

import EarlyCheckouts from './pages/admin/EarlyCheckouts';
import FaceResets from './pages/admin/FaceResets';
import ShiftScheduler from './pages/admin/ShiftScheduler';
import EmployeeRequests from './pages/admin/EmployeeRequests';

// Employee Pages
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import MyAttendance from './pages/employee/MyAttendance';
import MyRequests from './pages/employee/MyRequests';
import MyShifts from './pages/employee/MyShifts';
import ApplyLeave from './pages/employee/ApplyLeave';
import MyPerformance from './pages/employee/MyPerformance';
import MyPayslips from './pages/employee/MyPayslips';
import ProfilePage from './pages/employee/ProfilePage';
import MediclaimPage from './pages/employee/MediclaimPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageEmployees from './pages/admin/ManageEmployees';
import SetHolidays from './pages/admin/SetHolidays';
import AttendanceOverview from './pages/admin/AttendanceOverview';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import SetLeaveQuotas from './pages/admin/SetLeaveQuotas';
import PerformanceReview from './pages/admin/PerformanceReview';
import GeneratePayroll from './pages/admin/GeneratePayroll';
import SetSalary from './pages/admin/SetSalary';
import Withdrawals from './pages/admin/Withdrawals';

// SuperAdmin Pages
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import SuperAdminSubscriptions from './pages/superadmin/SuperAdminSubscriptions';
import SuperAdminCMS from './pages/superadmin/SuperAdminCMS';
import SuperAdminInquiries from './pages/superadmin/SuperAdminInquiries';

export const ADMIN_ROLES = [
  'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
  'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
];

export const EMPLOYEE_ROLES = [
  'Employee',
  'Project Manager', 'Project Lead', 'General Manager', 'CIO', 'CISO',
  'Frontend Engineer', 'Backend Engineer', 'Full-Stack Engineer', 'Mobile Developer', 'QA Engineer',
  'DevOps Engineer', 'Product Manager', 'UI Designer', 'UX Designer', 'Technical Writer',
  'Data Analyst', 'Data Scientist', 'Data Engineer', 'AI/ML Engineer', 'Cloud Architect',
  'System Administrator', 'Network Engineer', 'Database Administrator', 'Security Analyst',
  'Penetration Tester', 'Incident Responder', 'Sales Engineer', 'Account Manager', 'Customer Success Manager',
  'Technical Support Specialist', 'Chief Marketing Officer', 'Director / Head of Marketing',
  'Product Marketing Manager', 'Technical Product Marketer', 'Demand Generation Manager',
  'Email Marketing Specialist', 'Growth Marketer / Hacker', 'Paid Media Specialist (PPC)',
  'Content Marketing Manager', 'Technical Copywriter', 'SEO Specialist', 'Social Media Manager',
  'PR / Communications Manager', 'Marketing Operations (MOPs) Manager',
  'Implementation / Onboarding Specialist', 'IT Project Manager',
  'IT Consultant / Business Analyst', 'Technical Support Engineer'
];

export const getRedirectPath = (u) => {
  if (!u) return '/';
  if (u.role === 'SuperAdmin') return '/superadmin/dashboard';
  if (ADMIN_ROLES.includes(u.role)) return '/admin/dashboard';
  return '/employee/dashboard';
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Landing & Sign In Portal */}
      <Route
        path="/"
        element={user ? <Navigate to={getRedirectPath(user)} replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to={getRedirectPath(user)} replace /> : <LandingPage />}
      />

      {/* Public — Password Reset (no auth required) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* SuperAdmin Master Routes */}
      <Route
        path="/superadmin"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin']}>
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route path="subscriptions" element={<SuperAdminSubscriptions />} />
        <Route path="cms" element={<SuperAdminCMS />} />
        <Route path="inquiries" element={<SuperAdminInquiries />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Employee Routes */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute allowedRoles={EMPLOYEE_ROLES}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard"   element={<EmployeeDashboard />} />
        <Route path="teams"       element={<TeamsPage />} />
        <Route path="meetings"    element={<MeetingsPage />} />
        <Route path="attendance"  element={<MyAttendance />} />
        <Route path="leaves"      element={<ApplyLeave />} />
        <Route path="requests"    element={<MyRequests />} />
        <Route path="shifts"      element={<MyShifts />} />
        <Route path="performance" element={<MyPerformance />} />
        <Route path="payslips"    element={<MyPayslips />} />
        <Route path="mediclaim"   element={<MediclaimPage />} />
        <Route path="profile"     element={<ProfilePage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Admin/HR Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={ADMIN_ROLES}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard"    element={<AdminDashboard />} />
        <Route path="teams"        element={<TeamsPage />} />
        <Route path="meetings"     element={<MeetingsPage />} />
        <Route path="employees"    element={<ManageEmployees />} />
        <Route path="holidays"     element={<SetHolidays />} />
        <Route path="shift-schedule" element={<ShiftScheduler />} />
        <Route path="attendance" element={<AttendanceOverview />} />
        <Route path="early-checkouts" element={<EarlyCheckouts />} />
        <Route path="face-resets" element={<FaceResets />} />
        <Route path="requests" element={<EmployeeRequests />} />
        <Route path="leaves" element={<LeaveApprovals />} />
        <Route path="set-leaves" element={<SetLeaveQuotas />} />
        <Route path="performance" element={<PerformanceReview />} />
        <Route path="payroll"      element={<GeneratePayroll />} />
        <Route path="set-salary"   element={<SetSalary />} />
        <Route path="withdrawals"  element={<Withdrawals defaultType="All" />} />
        <Route path="mediclaim-requests" element={<Withdrawals defaultType="Mediclaim" />} />
        <Route path="pf-withdrawals" element={<Withdrawals defaultType="PF" />} />
        <Route path="profile"      element={<ProfilePage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={<Navigate to={user ? getRedirectPath(user) : '/'} replace />}
      />
    </Routes>
  );
}

export default App;

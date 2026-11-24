import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ADMIN_ROLES = [
  'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
  'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
];

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 1. If route specifically requires SuperAdmin
  if (allowedRoles && allowedRoles.includes('SuperAdmin')) {
    if (user.role === 'SuperAdmin') {
      return children;
    }
    return <Navigate to={ADMIN_ROLES.includes(user.role) ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }

  // 2. SuperAdmin cannot access regular company tenant operational routes (strict data isolation)
  if (user.role === 'SuperAdmin') {
    return <Navigate to="/superadmin/dashboard" replace />;
  }

  // 3. Admin has access to all tenant administrative routes
  if (user.role === 'Admin') {
    return children;
  }

  // 4. Check for allowed roles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (ADMIN_ROLES.includes(user.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

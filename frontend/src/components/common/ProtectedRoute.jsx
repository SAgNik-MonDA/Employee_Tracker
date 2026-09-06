import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const ADMIN_ROLES = [
    'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 
    'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
  ];

  // Admin always has full access to everything
  if (user.role === 'Admin') {
    return children;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (ADMIN_ROLES.includes(user.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

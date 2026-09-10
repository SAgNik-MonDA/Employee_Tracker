import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import API from '../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineMail, HiOutlineLockClosed,
  HiOutlineEye, HiOutlineEyeOff, HiOutlineX,
  HiOutlineArrowLeft, HiOutlineIdentification,
} from 'react-icons/hi';

const LoginPage = () => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail]         = useState('');
  const [forgotLoading, setForgotLoading]     = useState(false);
  const [forgotSent, setForgotSent]           = useState(false);

  // ── Sign In ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeCode || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const data = await login(employeeCode, email, password);
      toast.success(`Welcome back, ${data.name}! 👋`);
      navigate(data.role === 'Employee' ? '/employee/dashboard' : '/admin/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ──────────────────────────────────────────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) { toast.error('Please enter your email'); return; }
    setForgotLoading(true);
    try {
      await API.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset email');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotSent(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-surface-950' : 'bg-surface-50'}`}>
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-2xl shadow-primary-500/30 mb-4">
            <span className="text-white font-bold text-2xl font-display">ET</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-surface-100">Employee Tracker</h1>
          <p className="text-surface-500 mt-1">Performance &amp; Payroll Management</p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-display font-bold text-surface-100 mb-1">Sign In</h2>
          <p className="text-sm text-surface-500 mb-8">Enter your credentials to access your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Employee Code */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Employee Code</label>
              <div className="relative">
                <HiOutlineIdentification className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 w-5 h-5" />
                <input
                  id="login-employee-code"
                  type="text"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  className="input-field pl-12"
                  placeholder="e.g. EMP-001 or ADMIN"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Email Address</label>
              <div className="relative">
                <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 w-5 h-5" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-12"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-surface-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 w-5 h-5" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-12 pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                >
                  {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-surface-600 mt-6">
          © 2026 Employee Tracker. All rights reserved.
        </p>
      </div>

      {/* ── Forgot Password Modal ────────────────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <div className="flex items-center gap-3">
                {forgotSent && (
                  <button onClick={() => setForgotSent(false)} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400">
                    <HiOutlineArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h2 className="text-xl font-display font-bold text-surface-100">
                  {forgotSent ? '📧 Check Your Email' : '🔑 Forgot Password'}
                </h2>
              </div>
              <button onClick={closeForgotModal} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {forgotSent ? (
                /* ── Success state ─── */
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📬</span>
                  </div>
                  <p className="text-surface-200 font-medium mb-2">Reset link sent!</p>
                  <p className="text-sm text-surface-500 mb-6">
                    If <span className="text-primary-400">{forgotEmail}</span> is registered,
                    you'll receive a password reset link shortly. Check your inbox (and spam folder).
                  </p>
                  <p className="text-xs text-amber-400">⏰ The link expires in 20 minutes.</p>
                  <button
                    onClick={closeForgotModal}
                    className="btn-primary mt-6 w-full"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                /* ── Email input form ─── */
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-surface-400">
                    Enter your registered email address and we'll send you a link to reset your password.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 w-5 h-5" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="input-field pl-12"
                        placeholder="you@company.com"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forgotLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : '📧 Send Reset Link'}
                    </button>
                    <button type="button" onClick={closeForgotModal} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;

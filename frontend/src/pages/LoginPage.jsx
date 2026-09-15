import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import {
  HiOutlineMail, HiOutlineLockClosed,
  HiOutlineEye, HiOutlineEyeOff, HiOutlineX,
  HiOutlineArrowLeft, HiOutlineIdentification,
  HiOutlineSun, HiOutlineMoon, HiOutlineQrcode,
} from 'react-icons/hi';

const LoginPage = () => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const { login, loginWithQr } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Login mode: 'credentials' or 'qr'
  const [loginMode, setLoginMode] = useState('credentials');

  // QR Scanner state
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const scanningRef = useRef(false);
  const [cameraReady, setCameraReady]     = useState(false);
  const [scanError, setScanError]         = useState('');
  const [qrScanning, setQrScanning]       = useState(false);

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

  // ── QR Scanner ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setScanError('');
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', true);
        await videoRef.current.play();
        setCameraReady(true);
        scanningRef.current = true;
        requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setScanError('Camera access denied. Please allow camera permission in your browser settings.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (!scanningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      scanningRef.current = false;
      handleQrResult(code.data);
      return;
    }

    requestAnimationFrame(scanFrame);
  }, []);

  const handleQrResult = async (qrData) => {
    setQrScanning(true);
    try {
      const data = await loginWithQr(qrData);
      stopCamera();
      toast.success(`Welcome back, ${data.name}! 🎉`);
      navigate(data.role === 'Employee' ? '/employee/dashboard' : '/admin/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'QR authentication failed');
      // Resume scanning after a failed attempt
      setTimeout(() => {
        scanningRef.current = true;
        setQrScanning(false);
        requestAnimationFrame(scanFrame);
      }, 2000);
    }
  };

  // Start/stop camera when mode changes
  useEffect(() => {
    if (loginMode === 'qr') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [loginMode, startCamera, stopCamera]);

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-surface-950 transition-colors duration-300">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-surface-900/50 border border-surface-700/50 backdrop-blur-md hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-all duration-300 shadow-xl"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <div className="relative w-6 h-6">
            <HiOutlineSun className={`w-6 h-6 absolute inset-0 transition-all duration-500 ${
              theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
            }`} />
            <HiOutlineMoon className={`w-6 h-6 absolute inset-0 transition-all duration-500 ${
              theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
            }`} />
          </div>
        </button>
      </div>

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
          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-surface-800/60 p-1 mb-6 border border-surface-700/50">
            <button
              onClick={() => setLoginMode('credentials')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                loginMode === 'credentials'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <HiOutlineLockClosed className="w-4 h-4" />
              Credentials
            </button>
            <button
              onClick={() => setLoginMode('qr')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                loginMode === 'qr'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <HiOutlineQrcode className="w-4 h-4" />
              Scan QR Code
            </button>
          </div>

          {/* ── Credentials Mode ──────────────────────────────────────────── */}
          {loginMode === 'credentials' && (
            <>
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
            </>
          )}

          {/* ── QR Scan Mode ──────────────────────────────────────────────── */}
          {loginMode === 'qr' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-display font-bold text-surface-100 mb-1">QR Code Login</h2>
                <p className="text-sm text-surface-500">Hold your QR code in front of the camera</p>
              </div>

              {/* Scanner Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-surface-900 border border-surface-700/50 aspect-square max-w-xs mx-auto">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Overlay */}
                {cameraReady && !qrScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Corner markers */}
                    <div className="absolute top-4 left-4 w-10 h-10 border-t-3 border-l-3 border-primary-400 rounded-tl-lg" />
                    <div className="absolute top-4 right-4 w-10 h-10 border-t-3 border-r-3 border-primary-400 rounded-tr-lg" />
                    <div className="absolute bottom-4 left-4 w-10 h-10 border-b-3 border-l-3 border-primary-400 rounded-bl-lg" />
                    <div className="absolute bottom-4 right-4 w-10 h-10 border-b-3 border-r-3 border-primary-400 rounded-br-lg" />

                    {/* Scanning line animation */}
                    <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-qr-scan" />
                  </div>
                )}

                {/* QR Processing Overlay */}
                {qrScanning && (
                  <div className="absolute inset-0 bg-surface-950/70 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-400 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-surface-300 font-medium">Verifying...</p>
                    </div>
                  </div>
                )}

                {/* Camera loading state */}
                {!cameraReady && !scanError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-900">
                    <div className="text-center">
                      <div className="w-10 h-10 border-3 border-surface-600 border-t-primary-400 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-surface-400">Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {scanError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-900 p-6">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
                        <HiOutlineX className="w-6 h-6 text-red-400" />
                      </div>
                      <p className="text-sm text-red-400 mb-3">{scanError}</p>
                      <button
                        onClick={startCamera}
                        className="text-xs text-primary-400 hover:text-primary-300 underline"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-surface-500 text-center px-4">
                📱 Position your QR code within the frame. It will be detected automatically.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-surface-600 mt-6">
          © 2026 Employee Tracker. All rights reserved.
        </p>
      </div>

      {/* ── Forgot Password Modal ────────────────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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

      {/* QR scanner animation keyframes */}
      <style>{`
        @keyframes qr-scan {
          0%   { top: 1rem; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 1rem); opacity: 0; }
        }
        .animate-qr-scan {
          animation: qr-scan 2.5s ease-in-out infinite;
        }
        .border-3 {
          border-width: 3px;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

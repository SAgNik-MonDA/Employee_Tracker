import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import {
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineX,
  HiOutlineArrowLeft,
  HiOutlineIdentification,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineQrcode,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineDocumentReport,
  HiOutlineCash,
  HiOutlineChevronRight,
} from 'react-icons/hi';
import LoginIllustration from '../components/auth/LoginIllustration';

const LoginPage = () => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const { login, loginWithQr }          = useAuth();
  const { theme, toggleTheme }          = useTheme();
  const navigate                        = useNavigate();

  // Login mode: 'credentials' or 'qr'
  const [loginMode, setLoginMode] = useState('credentials');

  // QR Scanner state
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const scanningRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanError, setScanError]     = useState('');
  const [qrScanning, setQrScanning]   = useState(false);

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
      toast.error(error.response?.data?.message || 'Login failed. Please check credentials.');
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
      setScanError('Camera access denied. Please allow camera permission in your browser.');
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
      setTimeout(() => {
        scanningRef.current = true;
        setQrScanning(false);
        requestAnimationFrame(scanFrame);
      }, 2000);
    }
  };

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
    if (!forgotEmail) {
      toast.error('Please enter your email');
      return;
    }
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
    <div className="min-h-screen relative overflow-x-hidden bg-surface-950 transition-colors duration-300 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* ── AMBIENT LIQUID MESH GRADIENT BLOBS ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-teal-500/15 rounded-full blur-[140px] animate-pulse-slow" />
        <div
          className="absolute top-1/3 -right-32 w-[550px] h-[550px] bg-amber-500/12 rounded-full blur-[130px] animate-pulse-slow"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute -bottom-32 left-1/4 w-[650px] h-[650px] bg-blue-600/12 rounded-full blur-[150px] animate-pulse-slow"
          style={{ animationDelay: '4s' }}
        />
        {/* Subtle geometric dot matrix overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,75,86,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(14,75,86,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-70" />
      </div>

      {/* ── TOP HEADER / NAV BAR ── */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        {/* Logo Mark */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-0.5 shadow-xl shadow-teal-900/30 border border-teal-400/40 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-teal-950 flex items-center justify-center">
              <span className="font-display font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-emerald-300 to-amber-300">
                ET
              </span>
            </div>
          </div>
          <div>
            <span className="text-lg font-display font-extrabold tracking-tight text-slate-900 dark:text-surface-100 flex items-center gap-1.5">
              EMPLOYEE TRACKER
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/15 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 font-bold border border-teal-500/30">
                PRO
              </span>
            </span>
            <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 block -mt-1 tracking-wider uppercase">
              Smart Attendance &amp; Payroll Suite
            </span>
          </div>
        </div>

        {/* Right Action: System Status & Theme Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass text-xs text-teal-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Portal Operational</span>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl liquid-glass text-surface-300 hover:text-surface-100 transition-all duration-300 shadow-md hover:scale-105"
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="relative w-5 h-5">
              <HiOutlineSun
                className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
                  theme === 'dark' ? 'rotate-0 scale-100 opacity-100 text-amber-300' : '-rotate-90 scale-0 opacity-0'
                }`}
              />
              <HiOutlineMoon
                className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
                  theme === 'light' ? 'rotate-0 scale-100 opacity-100 text-teal-600' : 'rotate-90 scale-0 opacity-0'
                }`}
              />
            </div>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT SPLIT SECTION (HERO + AUTH CARD) ── */}
      <main className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* ══════════════════════════════════════════════════════════════════════
              LEFT / HERO COLUMN: FINANCIAL INSIGHTS & STRATEGY SHOWCASE
             ══════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 dark:liquid-glass-teal text-xs font-bold text-teal-800 dark:text-teal-200 border border-teal-500/30 w-fit shadow-md shadow-teal-950/10">
              <HiOutlineSparkles className="w-4 h-4 text-amber-500 dark:text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span>ENTERPRISE WORKFORCE &amp; STATUTORY PAYROLL</span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-slate-900 dark:text-surface-100 tracking-tight leading-[1.12]">
                SMART ATTENDANCE <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-emerald-600 to-amber-600 dark:from-teal-300 dark:via-emerald-400 dark:to-amber-300">
                  &amp; PAYROLL SUITE
                </span>
              </h1>
              <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-surface-200 leading-snug">
                Automated biometric attendance, monthly PF &amp; Mediclaim deductions, and instant bank payout advice.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-surface-400 leading-relaxed max-w-2xl">
                Scheduled auto-deductions every 2nd of the month with dual payroll generation (bulk &amp; manual) and one-click finance bank transfer schedules.
              </p>
            </div>

            {/* Rich Vector Graphic Illustration matching user screenshot */}
            <div className="py-2">
              <LoginIllustration />
            </div>

            {/* 3 Interactive Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* Feature 1: Smart Attendance */}
              <div className="liquid-glass p-4 rounded-2xl border-[1.5px] border-teal-500/40 hover:border-teal-400 transition-all duration-300 group hover:-translate-y-1 shadow-lg shadow-teal-950/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-800 to-teal-950 border border-teal-400/30 flex items-center justify-center text-teal-300 shadow-md shadow-teal-900/30 mb-3 group-hover:scale-105 transition-transform">
                  <HiOutlineQrcode className="w-5 h-5 text-teal-300" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-surface-100 mb-1">Smart Attendance</h4>
                <p className="text-[11px] text-slate-600 dark:text-surface-400 leading-relaxed">
                  Biometric face verify &amp; QR badge check-in with auto-checkout &amp; late penalty rules.
                </p>
              </div>

              {/* Feature 2: Automated PF & Mediclaim */}
              <div className="liquid-glass p-4 rounded-2xl border-[1.5px] border-teal-500/40 hover:border-amber-400 transition-all duration-300 group hover:-translate-y-1 shadow-lg shadow-teal-950/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 border border-amber-400/30 flex items-center justify-center text-white shadow-md shadow-amber-900/30 mb-3 group-hover:scale-105 transition-transform">
                  <HiOutlineCash className="w-5 h-5 text-amber-100" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-surface-100 mb-1">Automated PF &amp; Mediclaim</h4>
                <p className="text-[11px] text-slate-600 dark:text-surface-400 leading-relaxed">
                  Auto-deductions executed on the 2nd of each month with real-time employee email alerts.
                </p>
              </div>

              {/* Feature 3: Bank Payout Advice */}
              <div className="liquid-glass p-4 rounded-2xl border-[1.5px] border-teal-500/40 hover:border-teal-300 transition-all duration-300 group hover:-translate-y-1 shadow-lg shadow-teal-950/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-900 border border-teal-400/30 flex items-center justify-center text-white shadow-md shadow-teal-900/30 mb-3 group-hover:scale-105 transition-transform">
                  <HiOutlineDocumentReport className="w-5 h-5 text-teal-100" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-surface-100 mb-1">Bank Payout Advice</h4>
                <p className="text-[11px] text-slate-600 dark:text-surface-400 leading-relaxed">
                  Bulk or single payslip generation with downloadable finance team bank disbursement PDF.
                </p>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              RIGHT COLUMN: PRODUCTION-GRADE LIQUID GLASS AUTH CARD
             ══════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border-[1.5px] border-teal-500/40 dark:border-teal-400/40">
              {/* Specular top rim shine */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />

              {/* Card Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-teal-950 p-0.5 shadow-xl shadow-teal-900/40 mb-3 border border-teal-500/30">
                  <div className="w-full h-full rounded-[14px] bg-teal-950/80 dark:bg-surface-900/60 backdrop-blur-md flex items-center justify-center">
                    <HiOutlineLockClosed className="w-6 h-6 text-teal-300" />
                  </div>
                </div>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-surface-100">Sign In to Portal</h2>
                <p className="text-xs text-slate-600 dark:text-surface-400 mt-1">
                  Access your HR, attendance, payroll &amp; financial workspace
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex rounded-xl bg-surface-900/80 p-1 mb-6 border border-surface-700/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => setLoginMode('credentials')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    loginMode === 'credentials'
                      ? 'bg-gradient-to-r from-teal-800 to-teal-700 text-white shadow-md shadow-teal-900/40 border border-teal-500/30'
                      : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  <HiOutlineLockClosed className="w-3.5 h-3.5" />
                  Credentials
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('qr')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    loginMode === 'qr'
                      ? 'bg-gradient-to-r from-teal-800 to-teal-700 text-white shadow-md shadow-teal-900/40 border border-teal-500/30'
                      : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  <HiOutlineQrcode className="w-3.5 h-3.5" />
                  Scan QR Badge
                </button>
              </div>

              {/* ── MODE A: CREDENTIALS SIGN IN ────────────────────────────── */}
              {loginMode === 'credentials' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Employee Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-surface-300 mb-1.5">
                      Employee Code
                    </label>
                    <div className="relative">
                      <HiOutlineIdentification className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-5 h-5 pointer-events-none" />
                      <input
                        id="login-employee-code"
                        type="text"
                        value={employeeCode}
                        onChange={(e) => setEmployeeCode(e.target.value)}
                        className="input-field pl-11 text-sm focus:border-teal-500 focus:ring-teal-500/20"
                        placeholder="e.g. EMP-001 or ADMIN-001"
                        required
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-surface-300 mb-1.5">
                      Corporate Email
                    </label>
                    <div className="relative">
                      <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-5 h-5 pointer-events-none" />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field pl-11 text-sm focus:border-teal-500 focus:ring-teal-500/20"
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-surface-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-[11px] text-teal-700 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 font-bold transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <HiOutlineLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-5 h-5 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field pl-11 pr-11 text-sm focus:border-teal-500 focus:ring-teal-500/20"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 transition-colors p-1"
                        tabIndex={-1}
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Sign In Submit Button */}
                  <button
                    id="login-submit"
                    type="submit"
                    disabled={loading}
                    className="w-full btn-brand-teal flex items-center justify-center gap-2 py-3 rounded-xl mt-4 text-sm shadow-xl"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying &amp; Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Workspace</span>
                        <HiOutlineChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ── MODE B: QR CODE SCANNER ─────────────────────────────────── */}
              {loginMode === 'qr' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-sm font-bold text-surface-100">Scan Employee QR Badge</h3>
                    <p className="text-xs text-surface-400 mt-0.5">
                      Position your physical or digital badge in front of the camera
                    </p>
                  </div>

                  {/* Scanner Viewport */}
                  <div className="relative rounded-2xl overflow-hidden bg-surface-950 border-2 border-teal-500/40 aspect-square max-w-[260px] mx-auto shadow-2xl">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanning Overlay Reticles */}
                    {cameraReady && !qrScanning && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* 4 Corner Markers */}
                        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-teal-400 rounded-tl-md" />
                        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-teal-400 rounded-tr-md" />
                        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-teal-400 rounded-bl-md" />
                        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-teal-400 rounded-br-md" />

                        {/* Animated Laser Scanning Line */}
                        <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_12px_#2dd4bf] animate-laser" />
                      </div>
                    )}

                    {/* Processing State */}
                    {qrScanning && (
                      <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-10 h-10 border-3 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-xs text-teal-200 font-semibold">Authenticating Badge...</p>
                        </div>
                      </div>
                    )}

                    {/* Camera Loading State */}
                    {!cameraReady && !scanError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-surface-950">
                        <div className="text-center p-4">
                          <div className="w-8 h-8 border-2 border-surface-700 border-t-teal-400 rounded-full animate-spin mx-auto mb-2" />
                          <p className="text-xs text-surface-400">Initializing Optical Camera...</p>
                        </div>
                      </div>
                    )}

                    {/* Camera Error State */}
                    {scanError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-surface-950 p-4">
                        <div className="text-center">
                          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-2">
                            <HiOutlineX className="w-5 h-5 text-rose-400" />
                          </div>
                          <p className="text-xs text-rose-300 mb-2 leading-relaxed">{scanError}</p>
                          <button
                            onClick={startCamera}
                            className="text-xs text-teal-400 hover:text-teal-300 underline font-semibold"
                          >
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-surface-400 text-center px-2">
                    💡 Keep the QR code steady and well lit. You will be redirected immediately upon detection.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Security Badge */}
            <div className="flex items-center justify-center gap-2 text-xs text-surface-500 mt-4">
              <HiOutlineShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>TLS 256-Bit Encrypted Corporate Authentication</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-surface-800/60 text-center text-xs text-surface-500">
        <p>&copy; 2026 Employee Tracker Enterprise HR &amp; Accounting System. All Rights Reserved.</p>
      </footer>

      {/* ── FORGOT PASSWORD LIQUID GLASS MODAL ── */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-surface-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="liquid-glass w-full max-w-md rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-700/50">
              <div className="flex items-center gap-2.5">
                {forgotSent && (
                  <button
                    onClick={() => setForgotSent(false)}
                    className="p-1 rounded-lg hover:bg-surface-800 text-surface-400"
                  >
                    <HiOutlineArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-base font-display font-bold text-surface-100 flex items-center gap-1.5">
                  {forgotSent ? '📬 Reset Instructions Sent' : '🔑 Reset Your Password'}
                </h3>
              </div>
              <button
                onClick={closeForgotModal}
                className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {forgotSent ? (
                <div className="text-center py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/10">
                    <HiOutlineCheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h4 className="text-base font-bold text-surface-100 mb-1">Check Your Inbox</h4>
                  <p className="text-xs text-surface-400 mb-4 leading-relaxed">
                    If <strong className="text-teal-300">{forgotEmail}</strong> matches a registered account, you will receive a secure password recovery link shortly.
                  </p>
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 mb-5">
                    ⏰ For security, the recovery token expires in 20 minutes.
                  </p>
                  <button onClick={closeForgotModal} className="btn-brand-teal w-full py-2.5 text-xs">
                    Return to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-surface-400 leading-relaxed">
                    Enter the corporate email associated with your employee account and we will dispatch an instant password reset link.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-surface-300 mb-1.5">Corporate Email</label>
                    <div className="relative">
                      <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 w-5 h-5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="input-field pl-11 text-sm focus:border-teal-500 focus:ring-teal-500/20"
                        placeholder="you@company.com"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn-brand-teal flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5"
                    >
                      {forgotLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Sending Link...</span>
                        </>
                      ) : (
                        'Send Recovery Link'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="px-4 py-2.5 rounded-xl border border-surface-700/60 text-xs font-semibold text-surface-300 hover:bg-surface-800 transition-colors"
                    >
                      Cancel
                    </button>
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

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/axios';
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
  HiOutlineQrcode,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
} from 'react-icons/hi';

const ADMIN_ROLES = [
  'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist',
  'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'
];

const LoginModal = ({ isOpen, onClose }) => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, loginWithQr } = useAuth();
  const navigate = useNavigate();

  // Mode: 'credentials' or 'qr'
  const [loginMode, setLoginMode] = useState('credentials');

  // QR Scanner state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanError, setScanError] = useState('');
  const [qrScanning, setQrScanning] = useState(false);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmployeeCode('');
      setEmail('');
      setPassword('');
      setShowForgotModal(false);
      setForgotSent(false);

      const t1 = setTimeout(() => {
        setEmployeeCode('');
        setEmail('');
        setPassword('');
      }, 50);

      const t2 = setTimeout(() => {
        setEmployeeCode('');
        setEmail('');
        setPassword('');
      }, 250);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen]);

  // ── QR Scanner logic ────────────────────────────────────────────────────────
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
      setScanError('Camera access denied. Please allow camera permissions.');
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
      onClose();
      if (data.role === 'SuperAdmin') {
        navigate('/superadmin/dashboard');
      } else if (ADMIN_ROLES.includes(data.role)) {
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
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
    if (isOpen && loginMode === 'qr') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, loginMode, startCamera, stopCamera]);

  // ── Credentials Submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeCode || !email || !password) {
      toast.error('Please fill in Employee Code, Email, and Password');
      return;
    }
    setLoading(true);
    try {
      const data = await login(employeeCode, email, password);
      toast.success(`Welcome back, ${data.name}! 👋`);
      onClose();
      if (data.role === 'SuperAdmin') {
        navigate('/superadmin/dashboard');
      } else if (ADMIN_ROLES.includes(data.role)) {
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Submit ──────────────────────────────────────────────────
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
      toast.success('Password reset link sent to your email!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset link');
    } finally {
      setForgotLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl border border-surface-700 overflow-hidden">
        {/* Top Specular Rim */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D2F801]/60 to-transparent" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        {!showForgotModal ? (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F1115] dark:bg-[#D2F801] text-[#D2F801] dark:text-[#0B0D11] shadow-xl mb-3">
                <span className="text-xl">🚀</span>
              </div>
              <h3 className="text-xl font-display font-extrabold text-surface-100 tracking-tight">
                Enterprise Portal Login
              </h3>
              <p className="text-xs font-medium text-surface-400 mt-1">
                Enter your employee credentials or scan your instant QR badge
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-full p-1 bg-surface-800/80 border border-surface-700 mb-5">
              <button
                type="button"
                onClick={() => setLoginMode('credentials')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  loginMode === 'credentials'
                    ? 'bg-[#0F1115] dark:bg-[#D2F801] text-white dark:text-[#0B0D11] shadow-md'
                    : 'text-surface-400 hover:text-surface-100'
                }`}
              >
                <HiOutlineIdentification className="w-4 h-4" />
                <span>Credentials</span>
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  loginMode === 'qr'
                    ? 'bg-[#0F1115] dark:bg-[#D2F801] text-white dark:text-[#0B0D11] shadow-md'
                    : 'text-surface-400 hover:text-surface-100'
                }`}
              >
                <HiOutlineQrcode className="w-4 h-4" />
                <span>QR Badge</span>
              </button>
            </div>

            {loginMode === 'credentials' ? (
              <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                {/* Offscreen decoy inputs to neutralize aggressive browser password manager auto-injection */}
                <div className="sr-only opacity-0 absolute -top-[9999px] -left-[9999px] pointer-events-none" aria-hidden="true">
                  <input type="text" name="fake_username_remember" tabIndex="-1" autoComplete="off" />
                  <input type="password" name="fake_password_remember" tabIndex="-1" autoComplete="new-password" />
                </div>

                {/* Employee Code */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                    Employee Code <span className="text-teal-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                      <HiOutlineIdentification className="w-4 h-4" />
                    </div>
                    <input
                      id="modal_employee_code"
                      name="emp_code_field_no_autofill"
                      type="text"
                      autoComplete="off"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder="e.g. EMP-001 or SUPERADMIN"
                      required
                      className="input-field pl-10 text-sm h-11 bg-surface-900/50"
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                    Work Email Address <span className="text-teal-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                      <HiOutlineMail className="w-4 h-4" />
                    </div>
                    <input
                      id="modal_work_email"
                      name="work_email_field_no_autofill"
                      type="email"
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="input-field pl-10 text-sm h-11 bg-surface-900/50"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-surface-300">
                      Secure Password <span className="text-teal-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                      <HiOutlineLockClosed className="w-4 h-4" />
                    </div>
                    <input
                      id="modal_work_password"
                      name="work_pass_field_no_autofill"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="input-field pl-10 pr-10 text-sm h-11 bg-surface-900/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-surface-200"
                    >
                      {showPassword ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-2 btn-primary rounded-full shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Secure Sign In</span>
                      <span>&rarr;</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* QR Scanner View */
              <div className="space-y-4">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black/60 border border-teal-500/30 flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Scanner Target Box */}
                  <div className="absolute inset-8 border-2 border-dashed border-teal-400/80 rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                    <span className="text-[11px] text-teal-300 font-bold bg-black/60 px-2 py-0.5 rounded">
                      Align QR Inside Box
                    </span>
                  </div>

                  {qrScanning && (
                    <div className="absolute inset-0 bg-teal-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2">
                      <div className="w-8 h-8 border-3 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                      <span className="text-xs font-semibold">Authenticating badge...</span>
                    </div>
                  )}
                </div>

                {scanError && (
                  <p className="text-xs text-rose-400 text-center font-medium bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                    {scanError}
                  </p>
                )}

                <p className="text-[11px] text-surface-400 text-center">
                  Point camera at the QR login card received on your registered corporate email.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Forgot Password View */
          <div>
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(false);
                setForgotSent(false);
              }}
              className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold mb-4"
            >
              <HiOutlineArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>

            <h3 className="text-xl font-display font-extrabold text-surface-100 mb-1">
              Reset Password
            </h3>
            <p className="text-xs text-surface-400 mb-5">
              Enter your work email address to receive password reset instructions.
            </p>

            {forgotSent ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-2">
                <HiOutlineCheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-200">Reset Email Dispatched!</h4>
                <p className="text-xs text-emerald-300/80 leading-relaxed">
                  We've sent password reset instructions to <strong>{forgotEmail}</strong>. Please check your inbox.
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                    Your Work Email
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="input-field text-sm h-11 bg-surface-900/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full h-11 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Reset Instructions'
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;

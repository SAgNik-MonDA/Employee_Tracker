import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { loadRazorpayScript } from '../../utils/loadRazorpay';
import {
  HiOutlineX,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineOfficeBuilding,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlinePhone,
  HiOutlineCreditCard,
  HiOutlineSparkles,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineClipboardCopy,
} from 'react-icons/hi';

const SubscribeModal = ({ isOpen, onClose, selectedPlan }) => {
  const navigate = useNavigate();
  const { updateSessionUser } = useAuth();

  // Registration form state
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Payment & lifecycle state
  const [paymentData, setPaymentData] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null);
  const [step, setStep] = useState('pay'); // 'pay' -> 'register' -> 'success'
  const [submitting, setSubmitting] = useState(false);
  const [initiatingPay, setInitiatingPay] = useState(false);
  const [verifyingPay, setVerifyingPay] = useState(false);

  // Reset modal cleanly whenever opened or plan switches
  useEffect(() => {
    if (isOpen) {
      setStep('pay');
      setPaymentData(null);
      setCreatedAccount(null);
      setCompanyName('');
      setAdminName('');
      setAdminEmail('');
      setPassword('');
      setPhone('');
      setShowPassword(false);
      setInitiatingPay(false);
      setVerifyingPay(false);
    }
  }, [isOpen, selectedPlan?.id]);

  // Clear delayed browser autofill when transitioning to Admin Account registration step
  useEffect(() => {
    if (isOpen && step === 'register') {
      setAdminEmail('');
      setPassword('');
      const t1 = setTimeout(() => {
        setAdminEmail('');
        setPassword('');
      }, 60);
      const t2 = setTimeout(() => {
        setAdminEmail('');
        setPassword('');
      }, 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen, step]);

  if (!isOpen || !selectedPlan) return null;

  // ── Step 1: Initiate Live Razorpay Checkout ─────────────────────────────────
  const handleInitiatePayment = async () => {
    setInitiatingPay(true);
    try {
      // 1. Ensure Razorpay SDK is loaded
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        toast.error('Unable to load Razorpay Checkout. Please check your internet connection or disable ad-blockers.');
        setInitiatingPay(false);
        return;
      }

      // 2. Create real Razorpay Order on backend
      const { data } = await API.post('/subscription/create-order', {
        planId: selectedPlan.id,
      });

      if (!data.success || !data.orderId || !data.key || data.isMock) {
        toast.error(data.message || 'Payment gateway is currently unavailable. Please try again later.');
        setInitiatingPay(false);
        return;
      }

      // 3. Configure and launch official Razorpay Checkout modal
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'Employee Tracker Enterprise',
        description: `Subscription: ${data.planTitle}`,
        order_id: data.orderId,
        handler: async function (response) {
          setVerifyingPay(true);
          try {
            const verifyRes = await API.post('/subscription/verify-payment', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (!verifyRes.data?.verified) {
              toast.error('Payment signature verification failed. Please contact support.');
              return;
            }

            setPaymentData({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Razorpay payment verified! Now set up your Enterprise Admin Account.');
            setStep('register');
          } catch (verifyErr) {
            toast.error(
              verifyErr.response?.data?.message || 'Unable to verify Razorpay payment signature.'
            );
          } finally {
            setVerifyingPay(false);
            setInitiatingPay(false);
          }
        },
        prefill: {
          name: adminName || '',
          email: adminEmail || '',
          contact: phone || '',
        },
        theme: {
          color: '#0d9488',
        },
        modal: {
          ondismiss: function () {
            setInitiatingPay(false);
            toast('Razorpay payment window closed', { icon: 'ℹ️' });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setInitiatingPay(false);
        toast.error(resp.error?.description || 'Payment failed or was declined by your bank.');
      });
      rzp.open();
    } catch (error) {
      console.error('Payment initiation error:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate Razorpay payment');
      setInitiatingPay(false);
    }
  };

  // ── Step 2: Register Company Admin Account after Verified Payment ───────────
  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    if (!companyName || !adminName || !adminEmail || !password) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!paymentData?.razorpayOrderId || !paymentData?.razorpayPaymentId || !paymentData?.razorpaySignature) {
      toast.error('Verified Razorpay payment record missing. Please complete payment first.');
      setStep('pay');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        planId: selectedPlan.id,
        razorpayOrderId: paymentData.razorpayOrderId,
        razorpayPaymentId: paymentData.razorpayPaymentId,
        razorpaySignature: paymentData.razorpaySignature,
        companyName,
        adminName,
        adminEmail,
        password,
        phone,
      };

      const { data } = await API.post('/subscription/verify-and-register', payload);

      // Persist session identically to AuthContext (sessionStorage)
      if (data.token && data.user) {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('user', JSON.stringify(data.user));
        await updateSessionUser(data.user);
      }

      setCreatedAccount({
        user: data.user,
        subscription: data.subscription,
      });
      toast.success(`Workspace activated for ${data.user.companyName}! 🚀`);
      setStep('success');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Account registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    const code = createdAccount?.user?.employeeCode;
    if (code) {
      navigator.clipboard?.writeText(code);
      toast.success(`Employee Code ${code} copied to clipboard!`);
    }
  };

  const handleLaunchDashboard = () => {
    onClose();
    navigate('/admin/dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl border-[1.5px] border-teal-500/40 overflow-y-auto max-h-[92vh]">
        {/* Top Specular Rim */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />

        {/* Close Button */}
        <button
          onClick={step === 'success' ? handleLaunchDashboard : onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 transition-colors"
          aria-label="Close"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        {step === 'pay' && (
          /* Step 1: Confirm Plan & Launch Razorpay */
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-900 border border-teal-400/30 text-teal-300 shadow-xl shadow-teal-950/40 mb-3">
                <HiOutlineSparkles className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-extrabold text-surface-100">
                Subscribe to {selectedPlan.title}
              </h3>
              <p className="text-xs text-surface-400 mt-1">
                Unlock automated attendance, biometric face checks, and monthly statutory payroll
              </p>
            </div>

            {/* Plan Summary Card */}
            <div className="bg-surface-900/60 border border-teal-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-surface-100 text-sm">{selectedPlan.title}</h4>
                  <p className="text-xs text-surface-400">{selectedPlan.billingCycle}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-display font-black text-emerald-500 dark:text-emerald-400">
                    ₹{selectedPlan.price?.toLocaleString()}
                  </div>
                  {selectedPlan.originalPrice && (
                    <span className="text-xs text-surface-500 line-through">
                      ₹{selectedPlan.originalPrice?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-surface-700/50 pt-3 space-y-2">
                {selectedPlan.features?.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-surface-300">
                    <HiOutlineCheckCircle className="w-4 h-4 text-teal-500 dark:text-teal-400 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Razorpay Secure Checkout Notice */}
            <div className="flex items-center gap-3 p-3.5 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs text-surface-200">
              <HiOutlineShieldCheck className="w-6 h-6 text-teal-500 dark:text-teal-400 flex-shrink-0" />
              <span>
                Encrypted Razorpay Payment Gateway. After payment verification, you will immediately set up your Company Admin account.
              </span>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleInitiatePayment}
              disabled={initiatingPay || verifyingPay}
              className="w-full h-12 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-xl shadow-teal-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
            >
              {initiatingPay || verifyingPay ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{verifyingPay ? 'Verifying Payment...' : 'Opening Razorpay...'}</span>
                </>
              ) : (
                <>
                  <HiOutlineCreditCard className="w-5 h-5" />
                  <span>Proceed to Pay ₹{selectedPlan.price?.toLocaleString()}</span>
                </>
              )}
            </button>
          </div>
        )}

        {step === 'register' && (
          /* Step 2: Set Up Company Admin Account */
          <div>
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
                <HiOutlineCheckCircle className="w-4 h-4" />
                <span>Payment Confirmed — ₹{selectedPlan.price?.toLocaleString()}</span>
              </div>
              <h3 className="text-xl font-display font-extrabold text-surface-100">
                Set Up Your Enterprise Admin Account
              </h3>
              <p className="text-xs text-surface-400 mt-1">
                You will use these credentials to log in, add employees, and manage payroll
              </p>
            </div>

            <form onSubmit={handleRegisterAdmin} autoComplete="off" className="space-y-3.5">
              {/* Offscreen decoy inputs to prevent browser auto-injection */}
              <div className="sr-only opacity-0 absolute -top-[9999px] -left-[9999px] pointer-events-none" aria-hidden="true">
                <input type="text" name="fake_sub_username" tabIndex="-1" autoComplete="off" />
                <input type="password" name="fake_sub_password" tabIndex="-1" autoComplete="new-password" />
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Company / Organization Name <span className="text-teal-500 dark:text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineOfficeBuilding className="w-4 h-4" />
                  </div>
                  <input
                    name="sub_company_name_field"
                    type="text"
                    autoComplete="off"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Technologies Pvt Ltd"
                    required
                    className="input-field pl-10 text-sm h-10 bg-surface-900/50"
                  />
                </div>
              </div>

              {/* Admin Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Managing Director / Admin Name <span className="text-teal-500 dark:text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineUser className="w-4 h-4" />
                  </div>
                  <input
                    name="sub_admin_name_field"
                    type="text"
                    autoComplete="off"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Sagnik Mondal"
                    required
                    className="input-field pl-10 text-sm h-10 bg-surface-900/50"
                  />
                </div>
              </div>

              {/* Admin Work Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Admin Work Email <span className="text-teal-500 dark:text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineMail className="w-4 h-4" />
                  </div>
                  <input
                    id="sub_admin_email_no_autofill"
                    name="sub_admin_email_field"
                    type="email"
                    autoComplete="off"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    required
                    className="input-field pl-10 text-sm h-10 bg-surface-900/50"
                  />
                </div>
              </div>

              {/* Admin Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Master Password <span className="text-teal-500 dark:text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineLockClosed className="w-4 h-4" />
                  </div>
                  <input
                    id="sub_admin_password_no_autofill"
                    name="sub_admin_password_field"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="input-field pl-10 pr-10 text-sm h-10 bg-surface-900/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-surface-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlinePhone className="w-4 h-4" />
                  </div>
                  <input
                    name="sub_admin_phone_field"
                    type="tel"
                    autoComplete="off"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="input-field pl-10 text-sm h-10 bg-surface-900/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 mt-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Complete Registration &amp; Launch Dashboard</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'success' && createdAccount && (
          /* Step 3: Workspace Activated & Show Admin Employee Code */
          <div className="space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 dark:text-emerald-400 shadow-xl">
              <HiOutlineCheckCircle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-2xl font-display font-extrabold text-surface-100">
                Workspace Activated! 🎉
              </h3>
              <p className="text-xs text-surface-400 mt-1">
                Save your Admin Employee Code below — you will need it alongside your email &amp; password to sign in.
              </p>
            </div>

            {/* Credentials Summary Box */}
            <div className="bg-surface-900/70 border border-teal-500/40 rounded-2xl p-5 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-surface-700/50 pb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-surface-400 block">
                    Your Admin Employee Code
                  </span>
                  <span className="text-2xl font-mono font-black text-teal-500 dark:text-teal-300">
                    {createdAccount.user?.employeeCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-600 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <HiOutlineClipboardCopy className="w-4 h-4" />
                  <span>Copy Code</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-surface-400 block">Organization</span>
                  <strong className="text-surface-100">{createdAccount.user?.companyName}</strong>
                </div>
                <div>
                  <span className="text-surface-400 block">Work Email</span>
                  <strong className="text-surface-100 break-all">{createdAccount.user?.email}</strong>
                </div>
                <div>
                  <span className="text-surface-400 block">Active Plan</span>
                  <strong className="text-emerald-500 dark:text-emerald-400">{createdAccount.subscription?.planName}</strong>
                </div>
                <div>
                  <span className="text-surface-400 block">Valid Until</span>
                  <strong className="text-surface-100">
                    {new Date(createdAccount.subscription?.endDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              </div>

              {createdAccount.subscription?.razorpayPaymentId && (
                <div className="pt-2 border-t border-surface-700/50 text-[11px] text-surface-400 font-mono">
                  Razorpay Ref: {createdAccount.subscription.razorpayPaymentId}
                </div>
              )}
            </div>

            <button
              onClick={handleLaunchDashboard}
              className="w-full h-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span>Launch Enterprise Dashboard</span>
              <span>&rarr;</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscribeModal;

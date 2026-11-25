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
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        toast.error('Unable to load Razorpay Checkout. Please check your internet connection or disable ad-blockers.');
        setInitiatingPay(false);
        return;
      }

      const { data } = await API.post('/subscription/create-order', {
        planId: selectedPlan.id,
      });

      if (!data.success || !data.orderId || !data.key || data.isMock) {
        toast.error(data.message || 'Payment gateway is currently unavailable. Please try again later.');
        setInitiatingPay(false);
        return;
      }

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
          color: '#0F1115',
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

  const stepMeta = {
    pay: {
      badge: 'Step 1 of 2',
      title: `Subscribe to ${selectedPlan.title}`,
      subtitle: 'Biometric attendance, payroll engine & direct finance exports',
    },
    register: {
      badge: 'Step 2 of 2',
      title: 'Set Up Enterprise Admin',
      subtitle: 'Create your organization credentials to launch workspace',
    },
    success: {
      badge: 'Activated',
      title: 'Workspace Activated!',
      subtitle: 'Save your Admin Employee Code below for future logins',
    },
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden bg-surface-900 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-surface-700 animate-slide-up">
        {/* Top Specular Rim */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D2F801]/70 to-transparent pointer-events-none" />

        {/* ── Pinned Header ── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-surface-700 bg-surface-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center shadow-lg flex-shrink-0">
              {step === 'success' ? (
                <HiOutlineCheckCircle className="w-6 h-6" />
              ) : (
                <HiOutlineSparkles className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-display font-extrabold text-surface-100 truncate">
                  {stepMeta.title}
                </h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D2F801] text-[#0B0D11] whitespace-nowrap">
                  {stepMeta.badge}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-surface-400 truncate mt-0.5">
                {stepMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={step === 'success' ? handleLaunchDashboard : onClose}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/60 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
          {step === 'pay' && (
            <>
              {/* Plan Summary Card */}
              <div className="bg-surface-800/60 border border-surface-700 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400 block mb-0.5">
                      Selected Plan
                    </span>
                    <h4 className="font-display font-bold text-surface-100 text-base sm:text-lg leading-tight">
                      {selectedPlan.title}
                    </h4>
                    <p className="text-xs text-surface-400 mt-0.5">{selectedPlan.billingCycle}</p>
                  </div>
                  <div className="text-right ml-auto">
                    <div className="text-2xl sm:text-3xl font-display font-black text-teal-400 leading-none">
                      ₹{selectedPlan.price?.toLocaleString()}
                    </div>
                    {selectedPlan.originalPrice && (
                      <span className="text-xs text-surface-500 line-through block mt-1">
                        ₹{selectedPlan.originalPrice?.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-surface-700/70 pt-3 grid grid-cols-1 gap-2">
                  {selectedPlan.features?.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs sm:text-[13px] text-surface-200">
                      <HiOutlineCheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Razorpay Secure Checkout Notice */}
              <div className="flex items-center gap-3 p-3 sm:p-3.5 bg-surface-800/70 border border-surface-700 rounded-xl text-xs text-surface-200">
                <HiOutlineShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400 flex-shrink-0" />
                <span className="leading-relaxed">
                  <strong>Encrypted Razorpay Checkout:</strong> Supports UPI, Cards, NetBanking &amp; Wallets. Instant workspace setup right after payment.
                </span>
              </div>
            </>
          )}

          {step === 'register' && (
            <>
              {/* Confirmed Payment Chip */}
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <HiOutlineCheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Payment Confirmed via Razorpay</span>
                </div>
                <span className="font-mono">₹{selectedPlan.price?.toLocaleString()}</span>
              </div>

              <form id="sub-admin-register-form" onSubmit={handleRegisterAdmin} autoComplete="off" className="space-y-3">
                {/* Offscreen decoy inputs to prevent browser auto-injection */}
                <div className="sr-only opacity-0 absolute -top-[9999px] -left-[9999px] pointer-events-none" aria-hidden="true">
                  <input type="text" name="fake_sub_username" tabIndex="-1" autoComplete="off" />
                  <input type="password" name="fake_sub_password" tabIndex="-1" autoComplete="new-password" />
                </div>

                {/* Company Name & Admin Name responsive 2-col on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-300 mb-1">
                      Company Name <span className="text-teal-500 dark:text-teal-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                        <HiOutlineOfficeBuilding className="w-4 h-4" />
                      </div>
                      <input
                        name="sub_company_name_field"
                        type="text"
                        autoComplete="off"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Tech Pvt Ltd"
                        required
                        className="input-field pl-9 py-2.5 text-sm h-10 bg-surface-800/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-300 mb-1">
                      Admin Full Name <span className="text-teal-500 dark:text-teal-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                        <HiOutlineUser className="w-4 h-4" />
                      </div>
                      <input
                        name="sub_admin_name_field"
                        type="text"
                        autoComplete="off"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="Sagnik Mondal"
                        required
                        className="input-field pl-9 py-2.5 text-sm h-10 bg-surface-800/60"
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Email & Phone responsive 2-col on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-300 mb-1">
                      Admin Work Email <span className="text-teal-500 dark:text-teal-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                        <HiOutlineMail className="w-4 h-4" />
                      </div>
                      <input
                        id="sub_admin_email_no_autofill"
                        name="sub_admin_email_field"
                        type="email"
                        autoComplete="off"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@company.com"
                        required
                        className="input-field pl-9 py-2.5 text-sm h-10 bg-surface-800/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-300 mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
                        <HiOutlinePhone className="w-4 h-4" />
                      </div>
                      <input
                        name="sub_admin_phone_field"
                        type="tel"
                        autoComplete="off"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="input-field pl-9 py-2.5 text-sm h-10 bg-surface-800/60"
                      />
                    </div>
                  </div>
                </div>

                {/* Master Password */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-300 mb-1">
                    Master Password <span className="text-teal-500 dark:text-teal-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
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
                      className="input-field pl-9 pr-10 py-2.5 text-sm h-10 bg-surface-800/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-surface-400 hover:text-surface-200 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}

          {step === 'success' && createdAccount && (
            <div className="bg-surface-800/50 border-[1.5px] border-teal-500/40 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2 border-b border-surface-700/50 pb-3 flex-wrap">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-surface-400 block">
                    Your Admin Employee Code
                  </span>
                  <span className="text-2xl font-mono font-black text-teal-600 dark:text-teal-300">
                    {createdAccount.user?.employeeCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <HiOutlineClipboardCopy className="w-4 h-4" />
                  <span>Copy Code</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                  <strong className="text-emerald-600 dark:text-emerald-400">{createdAccount.subscription?.planName}</strong>
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
                <div className="pt-2 border-t border-surface-700/50 text-[11px] text-surface-400 font-mono truncate">
                  Razorpay Ref: {createdAccount.subscription.razorpayPaymentId}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Pinned Footer CTA ── */}
        <div className="flex-shrink-0 px-4 py-3.5 sm:px-6 sm:py-4 border-t border-surface-700 bg-surface-900">
          {step === 'pay' && (
            <button
              type="button"
              onClick={handleInitiatePayment}
              disabled={initiatingPay || verifyingPay}
              className="w-full h-11 sm:h-12 btn-primary rounded-full shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {initiatingPay || verifyingPay ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>{verifyingPay ? 'Verifying Payment...' : 'Opening Razorpay...'}</span>
                </>
              ) : (
                <>
                  <HiOutlineCreditCard className="w-5 h-5" />
                  <span>Proceed to Pay ₹{selectedPlan.price?.toLocaleString()}</span>
                </>
              )}
            </button>
          )}

          {step === 'register' && (
            <button
              type="submit"
              form="sub-admin-register-form"
              disabled={submitting}
              className="w-full h-11 sm:h-12 btn-primary rounded-full shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Complete Registration &amp; Launch Dashboard</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          )}

          {step === 'success' && (
            <button
              type="button"
              onClick={handleLaunchDashboard}
              className="w-full h-11 sm:h-12 btn-primary rounded-full shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span>Launch Enterprise Dashboard</span>
              <span>&rarr;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscribeModal;

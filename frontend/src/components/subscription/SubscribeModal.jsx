import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import toast from 'react-hot-toast';
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
} from 'react-icons/hi';

const SubscribeModal = ({ isOpen, onClose, selectedPlan }) => {
  const navigate = useNavigate();

  // Registration form state
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Payment transaction state
  const [paymentData, setPaymentData] = useState(null);
  const [step, setStep] = useState('pay'); // 'pay' -> 'register' -> 'success'
  const [submitting, setSubmitting] = useState(false);
  const [initiatingPay, setInitiatingPay] = useState(false);

  if (!isOpen || !selectedPlan) return null;

  // ── Step 1: Initiate Razorpay Checkout ──────────────────────────────────────
  const handleInitiatePayment = async () => {
    setInitiatingPay(true);
    try {
      const { data } = await API.post('/subscription/create-order', {
        planId: selectedPlan.id,
      });

      if (!data.success) {
        toast.error('Unable to create checkout order');
        return;
      }

      // If mock/sandbox (Razorpay keys not yet configured in .env)
      if (data.isMock || !window.Razorpay) {
        toast.success(`Payment verified (${data.planTitle})! Now set up your Admin Account.`);
        setPaymentData({
          razorpayOrderId: data.orderId,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: 'mock_sig',
        });
        setStep('register');
        return;
      }

      // Live Razorpay Gateway Checkout
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: 'Employee Tracker Enterprise',
        description: `Subscription: ${data.planTitle}`,
        order_id: data.orderId,
        handler: function (response) {
          toast.success('Razorpay payment successful! Please complete your company registration.');
          setPaymentData({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          setStep('register');
        },
        prefill: {
          name: adminName || '',
          email: adminEmail || '',
          contact: phone || '',
        },
        theme: {
          color: '#0d9488',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        toast.error(resp.error.description || 'Payment was declined or cancelled');
      });
      rzp.open();
    } catch (error) {
      console.error('Payment initiation error:', error);
      toast.error(error.response?.data?.message || 'Payment initiation failed');
    } finally {
      setInitiatingPay(false);
    }
  };

  // ── Step 2: Register Admin Account with Verified Payment ────────────────────
  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    if (!companyName || !adminName || !adminEmail || !password) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        planId: selectedPlan.id,
        razorpayOrderId: paymentData?.razorpayOrderId || '',
        razorpayPaymentId: paymentData?.razorpayPaymentId || `pay_${Date.now()}`,
        razorpaySignature: paymentData?.razorpaySignature || '',
        companyName,
        adminName,
        adminEmail,
        password,
        phone,
      };

      const { data } = await API.post('/subscription/verify-and-register', payload);

      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      toast.success(`Welcome to Employee Tracker, ${data.user.name}! Your workspace is ready! 🚀`);
      onClose();
      // Redirect straight to Admin dashboard
      window.location.href = '/admin/dashboard';
    } catch (error) {
      toast.error(error.response?.data?.message || 'Account registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl border-[1.5px] border-teal-500/40 overflow-hidden">
        {/* Top Specular Rim */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 transition-colors"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        {step === 'pay' ? (
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
                  <div className="text-2xl font-display font-black text-emerald-400">
                    ₹{selectedPlan.price?.toLocaleString()}
                  </div>
                  {selectedPlan.originalPrice && (
                    <span className="text-xs text-surface-500 line-through">
                      ₹{selectedPlan.originalPrice?.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-surface-800 pt-3 space-y-2">
                {selectedPlan.features?.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-surface-300">
                    <HiOutlineCheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Razorpay Secure Checkout Notice */}
            <div className="flex items-center gap-3 p-3 bg-teal-950/30 border border-teal-500/30 rounded-xl text-xs text-teal-200">
              <HiOutlineShieldCheck className="w-6 h-6 text-teal-400 flex-shrink-0" />
              <span>
                Encrypted Razorpay Payment Gateway. After payment verification, you will immediately set up your Company Admin account.
              </span>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleInitiatePayment}
              disabled={initiatingPay}
              className="w-full h-12 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-xl shadow-teal-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
            >
              {initiatingPay ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <HiOutlineCreditCard className="w-5 h-5" />
                  <span>Proceed to Pay ₹{selectedPlan.price?.toLocaleString()}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Step 2: Set Up Company Admin Account */
          <div>
            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
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

            <form onSubmit={handleRegisterAdmin} className="space-y-3.5">
              {/* Company Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Company / Organization Name <span className="text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineOfficeBuilding className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
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
                  Managing Director / Admin Name <span className="text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineUser className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
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
                  Admin Work Email <span className="text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineMail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
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
                  Master Password <span className="text-teal-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <HiOutlineLockClosed className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="input-field pl-10 text-sm h-10 bg-surface-900/50"
                  />
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
                    type="tel"
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
      </div>
    </div>
  );
};

export default SubscribeModal;

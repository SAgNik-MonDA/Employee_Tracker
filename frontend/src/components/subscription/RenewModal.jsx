import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { loadRazorpayScript } from '../../utils/loadRazorpay';
import {
  HiOutlineX,
  HiOutlineShieldCheck,
  HiOutlineCreditCard,
  HiOutlineRefresh,
} from 'react-icons/hi';

const RenewModal = ({ isOpen, onClose, currentSub, onRenewed }) => {
  const { user } = useAuth();
  const [plans, setPlans] = useState({
    monthly: { price: 999, title: 'Monthly Flex', billingCycle: '1 Month' },
    yearly: { price: 9999, title: 'Annual Growth', billingCycle: '1 Year (Save 38%)', isPopular: true },
    three_year: { price: 24999, title: '3-Year Enterprise', billingCycle: '3 Years (Save 45%)' },
  });

  const [selectedPlanId, setSelectedPlanId] = useState(currentSub?.planId || 'yearly');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentSub?.planId) setSelectedPlanId(currentSub.planId);
      API.get('/landing/public-content')
        .then(({ data }) => {
          if (data.pricingPlans) setPlans(data.pricingPlans);
        })
        .catch(() => {});
    }
  }, [isOpen, currentSub?.planId]);

  if (!isOpen) return null;

  const handleRenewPayment = async () => {
    setLoading(true);
    try {
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        toast.error('Unable to load Razorpay Checkout. Please check your internet connection or disable ad-blockers.');
        setLoading(false);
        return;
      }

      const selected = plans[selectedPlanId];
      const { data } = await API.post('/subscription/create-order', {
        planId: selectedPlanId,
      });

      if (!data.success || !data.orderId || !data.key || data.isMock) {
        toast.error(data.message || 'Payment gateway is currently unavailable.');
        setLoading(false);
        return;
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'Employee Tracker Enterprise',
        description: `Renew Subscription: ${selected?.title || data.planTitle}`,
        order_id: data.orderId,
        handler: async function (response) {
          try {
            const renewRes = await API.post('/subscription/renew', {
              planId: selectedPlanId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success(renewRes.data.message || 'Subscription renewed! 🎉');
            if (onRenewed) onRenewed(renewRes.data.subscription);
            onClose();
          } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to verify and update subscription');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#0d9488',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast('Renewal checkout cancelled', { icon: 'ℹ️' });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setLoading(false);
        toast.error(resp.error?.description || 'Payment was declined');
      });
      rzp.open();
    } catch (error) {
      console.error('Renew error:', error);
      toast.error(error.response?.data?.message || 'Payment initiation failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-950/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden bg-surface-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl border-[1.5px] border-teal-500/50 animate-slide-up">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent pointer-events-none" />

        {/* Pinned Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-surface-700/50 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-800 border border-teal-400/30 text-teal-100 flex items-center justify-center shadow-lg flex-shrink-0">
              <HiOutlineRefresh className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-display font-extrabold text-surface-100 truncate">
                Renew Corporate Plan
              </h3>
              <p className="text-[11px] sm:text-xs text-surface-400 truncate mt-0.5">
                Extend access seamlessly with zero data loss
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/60 transition-colors flex-shrink-0 cursor-pointer"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
          <div className="space-y-2.5">
            {Object.keys(plans).map((pId) => {
              const plan = plans[pId];
              const isSelected = selectedPlanId === pId;
              return (
                <div
                  key={pId}
                  onClick={() => setSelectedPlanId(pId)}
                  className={`p-3.5 sm:p-4 rounded-2xl border-[1.5px] transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/15 shadow-md shadow-emerald-950/20'
                      : 'border-surface-700/60 bg-surface-800/40 hover:border-teal-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-emerald-500' : 'border-surface-500'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-surface-100 truncate">{plan.title}</h4>
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold block">
                        {plan.billingCycle}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-base sm:text-lg font-display font-black text-emerald-600 dark:text-emerald-400">
                      ₹{plan.price?.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl text-xs text-surface-200">
            <HiOutlineShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <span>Encrypted Razorpay checkout. Immediate extension upon payment.</span>
          </div>
        </div>

        {/* Pinned Footer */}
        <div className="flex-shrink-0 px-4 py-3.5 sm:px-6 sm:py-4 border-t border-surface-700/50 bg-surface-900/60">
          <button
            type="button"
            onClick={handleRenewPayment}
            disabled={loading}
            className="w-full h-11 sm:h-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Opening Razorpay...</span>
              </>
            ) : (
              <>
                <HiOutlineCreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Renew Now (₹{plans[selectedPlanId]?.price?.toLocaleString()})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenewModal;

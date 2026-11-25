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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl border-[1.5px] border-teal-500/40 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-100 transition-colors"
        >
          <HiOutlineX className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-900 border border-teal-400/30 text-teal-300 shadow-xl mb-2">
            <HiOutlineRefresh className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <h3 className="text-xl font-display font-extrabold text-surface-100">
            Renew Corporate Subscription
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            Choose your plan duration. Time will be added seamlessly with zero data loss.
          </p>
        </div>

        {/* Plan Selector Options */}
        <div className="space-y-3 mb-6">
          {Object.keys(plans).map((pId) => {
            const plan = plans[pId];
            const isSelected = selectedPlanId === pId;
            return (
              <div
                key={pId}
                onClick={() => setSelectedPlanId(pId)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-950/20'
                    : 'border-surface-700/60 bg-surface-900/50 hover:border-teal-500/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-emerald-500' : 'border-surface-600'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-surface-100">{plan.title}</h4>
                    <span className="text-[10px] text-teal-500 dark:text-teal-400 font-semibold">
                      {plan.billingCycle}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-base font-display font-black text-emerald-500 dark:text-emerald-400">
                    ₹{plan.price?.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-2.5 bg-teal-500/10 border border-teal-500/30 rounded-xl text-[11px] text-surface-200 mb-5">
          <HiOutlineShieldCheck className="w-4 h-4 text-teal-500 dark:text-teal-400 flex-shrink-0" />
          <span>Encrypted Razorpay checkout. Immediate extension upon payment.</span>
        </div>

        <button
          onClick={handleRenewPayment}
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Opening Razorpay...</span>
            </>
          ) : (
            <>
              <HiOutlineCreditCard className="w-4 h-4" />
              <span>Renew Now (₹{plans[selectedPlanId]?.price?.toLocaleString()})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RenewModal;

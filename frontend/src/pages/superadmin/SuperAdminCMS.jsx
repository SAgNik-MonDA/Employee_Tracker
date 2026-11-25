import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineTemplate,
  HiOutlineOfficeBuilding,
  HiOutlineQuestionMarkCircle,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineCheck,
  HiOutlineCreditCard,
  HiOutlineShieldCheck,
} from 'react-icons/hi';

const SuperAdminCMS = () => {
  const [activeTab, setActiveTab] = useState('pricing'); // 'pricing' | 'clients' | 'faqs' | 'gateway'

  // Pricing Plans state
  const [pricing, setPricing] = useState({
    monthly: { price: 999, originalPrice: 1499, title: 'Monthly Flex', description: '' },
    yearly: { price: 9999, originalPrice: 15999, title: 'Annual Growth', description: '' },
    three_year: { price: 24999, originalPrice: 44999, title: '3-Year Enterprise', description: '' },
  });
  const [savingPricing, setSavingPricing] = useState(false);

  // Clients state
  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientLogo, setNewClientLogo] = useState('');
  const [addingClient, setAddingClient] = useState(false);

  // FAQs state
  const [faqs, setFaqs] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [addingFaq, setAddingFaq] = useState(false);

  // Razorpay Gateway Config state
  const [gatewayStatus, setGatewayStatus] = useState({
    configured: false,
    keyId: '',
    maskedSecret: '',
    mode: 'unconfigured',
    source: 'none',
  });
  const [rzpKeyId, setRzpKeyId] = useState('');
  const [rzpKeySecret, setRzpKeySecret] = useState('');
  const [savingGateway, setSavingGateway] = useState(false);

  useEffect(() => {
    fetchCMSData();
    fetchGatewayConfig();
  }, []);

  const fetchGatewayConfig = async () => {
    try {
      const { data } = await API.get('/subscription/gateway-config');
      if (data.success) {
        setGatewayStatus(data);
        if (data.keyId) setRzpKeyId(data.keyId);
      }
    } catch {
      // ignore initial load error
    }
  };

  const handleSaveGateway = async (e) => {
    e.preventDefault();
    if (!rzpKeyId.trim() || !rzpKeySecret.trim()) {
      toast.error('Both Razorpay Key ID and Key Secret are required');
      return;
    }
    setSavingGateway(true);
    try {
      const { data } = await API.put('/subscription/gateway-config', {
        keyId: rzpKeyId.trim(),
        keySecret: rzpKeySecret.trim(),
      });
      toast.success(data.message || 'Razorpay credentials verified and activated! 💳');
      setRzpKeySecret('');
      fetchGatewayConfig();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save Razorpay credentials');
    } finally {
      setSavingGateway(false);
    }
  };

  const fetchCMSData = async () => {
    try {
      const { data } = await API.get('/landing/public-content');
      if (data.pricingPlans) setPricing(data.pricingPlans);
      if (data.clients) setClients(data.clients);
      if (data.faqs) setFaqs(data.faqs);
    } catch (error) {
      console.error('Fetch CMS error:', error);
      toast.error('Failed to load CMS content');
    }
  };

  // ── Pricing Handlers ─────────────────────────────────────────────────────────
  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      const { data } = await API.put('/landing/pricing', { pricingPlans: pricing });
      toast.success(data.message || 'Pricing plans updated successfully! 💎');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update pricing');
    } finally {
      setSavingPricing(false);
    }
  };

  // ── Client Handlers ──────────────────────────────────────────────────────────
  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientName || !newClientLogo) {
      toast.error('Client name and logo URL are required');
      return;
    }
    setAddingClient(true);
    try {
      const { data } = await API.post('/landing/clients', {
        name: newClientName,
        logoUrl: newClientLogo,
      });
      toast.success('Client logo added! 🏢');
      if (data.clients) setClients(data.clients);
      setNewClientName('');
      setNewClientLogo('');
    } catch (error) {
      toast.error('Failed to add client');
    } finally {
      setAddingClient(false);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      const { data } = await API.delete(`/landing/clients/${id}`);
      toast.success('Client deleted! 🗑️');
      if (data.clients) setClients(data.clients);
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  // ── FAQ Handlers ─────────────────────────────────────────────────────────────
  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!newQuestion || !newAnswer) {
      toast.error('Question and answer are required');
      return;
    }
    setAddingFaq(true);
    try {
      const { data } = await API.post('/landing/faqs', {
        question: newQuestion,
        answer: newAnswer,
      });
      toast.success('FAQ created successfully! ❓');
      if (data.faqs) setFaqs(data.faqs);
      setNewQuestion('');
      setNewAnswer('');
    } catch (error) {
      toast.error('Failed to add FAQ');
    } finally {
      setAddingFaq(false);
    }
  };

  const handleDeleteFaq = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      const { data } = await API.delete(`/landing/faqs/${id}`);
      toast.success('FAQ deleted! 🗑️');
      if (data.faqs) setFaqs(data.faqs);
    } catch (error) {
      toast.error('Failed to delete FAQ');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display font-black text-surface-100">
          Landing Page CMS Management
        </h2>
        <p className="text-xs sm:text-sm text-surface-400 mt-1">
          Dynamically modify the 3 subscription prices, manage client logo marquee, and edit platform FAQs
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl p-1 bg-surface-900 border border-surface-800 w-fit">
        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'pricing'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <HiOutlineTemplate className="w-4 h-4" />
          <span>Subscription Pricing Plans</span>
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'clients'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <HiOutlineOfficeBuilding className="w-4 h-4" />
          <span>Client Logos Marquee</span>
        </button>

        <button
          onClick={() => setActiveTab('faqs')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'faqs'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <HiOutlineQuestionMarkCircle className="w-4 h-4" />
          <span>Questions &amp; Answers (FAQs)</span>
        </button>

        <button
          onClick={() => setActiveTab('gateway')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'gateway'
              ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <HiOutlineCreditCard className="w-4 h-4" />
          <span>Razorpay Gateway</span>
        </button>
      </div>

      {/* ── TAB 1: PRICING PLANS ── */}
      {activeTab === 'pricing' && (
        <form onSubmit={handleSavePricing} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly */}
            <div className="liquid-glass rounded-3xl p-6 border border-teal-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-teal-400">1. Monthly Plan</h3>
                <span className="text-[10px] text-surface-400">Recurring 30 Days</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Plan Title</label>
                <input
                  type="text"
                  value={pricing.monthly?.title || ''}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      monthly: { ...pricing.monthly, title: e.target.value },
                    })
                  }
                  className="input-field text-xs h-10 bg-surface-900/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={pricing.monthly?.price || 0}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        monthly: { ...pricing.monthly, price: Number(e.target.value) },
                      })
                    }
                    className="input-field text-xs h-10 font-bold text-emerald-400 bg-surface-900/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1">Strikethrough (₹)</label>
                  <input
                    type="number"
                    value={pricing.monthly?.originalPrice || 0}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        monthly: { ...pricing.monthly, originalPrice: Number(e.target.value) },
                      })
                    }
                    className="input-field text-xs h-10 text-surface-400 bg-surface-900/60"
                  />
                </div>
              </div>
            </div>

            {/* Yearly */}
            <div className="liquid-glass rounded-3xl p-6 border-2 border-emerald-500/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-emerald-400">2. Yearly Plan</h3>
                <span className="text-[10px] font-bold text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-950/60">
                  Most Popular
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Plan Title</label>
                <input
                  type="text"
                  value={pricing.yearly?.title || ''}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      yearly: { ...pricing.yearly, title: e.target.value },
                    })
                  }
                  className="input-field text-xs h-10 bg-surface-900/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={pricing.yearly?.price || 0}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, price: Number(e.target.value) },
                      })
                    }
                    className="input-field text-xs h-10 font-bold text-emerald-400 bg-surface-900/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1">Strikethrough (₹)</label>
                  <input
                    type="number"
                    value={pricing.yearly?.originalPrice || 0}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        yearly: { ...pricing.yearly, originalPrice: Number(e.target.value) },
                      })
                    }
                    className="input-field text-xs h-10 text-surface-400 bg-surface-900/60"
                  />
                </div>
              </div>
            </div>

            {/* 3-Year Enterprise */}
            <div className="liquid-glass rounded-3xl p-6 border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-amber-300">3. 3-Year Enterprise Plan</h3>
                <span className="text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-950/60">
                  Best Value
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Plan Title</label>
                <input
                  type="text"
                  value={pricing.three_year?.title || ''}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      three_year: { ...pricing.three_year, title: e.target.value },
                    })
                  }
                  className="input-field text-xs h-10 bg-surface-900/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={pricing.three_year?.price || 0}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        three_year: { ...pricing.three_year, price: Number(e.target.value) },
                      })
                    }
                    className="input-field text-xs h-10 font-bold text-amber-300 bg-surface-900/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-surface-300 mb-1">Strikethrough (₹)</label>
                  <input
                    type="number"
                    value={pricing.three_year?.originalPrice || 0}
                    onChange={(e) =>
                      setPricing({
                        ...pricing,
                        three_year: { ...pricing.three_year, originalPrice: Number(e.target.value) },
                      })
                    }
                    className="input-field text-xs h-10 text-surface-400 bg-surface-900/60"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPricing}
            className="px-6 py-3 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
          >
            {savingPricing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <HiOutlineCheck className="w-5 h-5" />
            )}
            <span>Save &amp; Publish Pricing Changes</span>
          </button>
        </form>
      )}

      {/* ── TAB 2: CLIENT LOGOS ── */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          <form onSubmit={handleAddClient} className="liquid-glass p-6 rounded-3xl border border-surface-800 space-y-4">
            <h3 className="text-base font-bold text-surface-100 flex items-center gap-2">
              <HiOutlinePlus className="w-5 h-5 text-teal-400" />
              <span>Add New Enterprise Client</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Client Company Name</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Reliance Corporate"
                  required
                  className="input-field text-xs h-10 bg-surface-900/60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Logo Image URL</label>
                <input
                  type="url"
                  value={newClientLogo}
                  onChange={(e) => setNewClientLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  required
                  className="input-field text-xs h-10 bg-surface-900/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingClient}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>Add to Client Marquee</span>
            </button>
          </form>

          {/* Existing Clients List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <div
                key={c._id}
                className="liquid-glass p-4 rounded-2xl border border-surface-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center font-bold text-teal-300">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-surface-100">{c.name}</h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteClient(c._id)}
                  className="p-2 text-surface-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: FAQS MANAGEMENT ── */}
      {activeTab === 'faqs' && (
        <div className="space-y-6">
          <form onSubmit={handleAddFaq} className="liquid-glass p-6 rounded-3xl border border-surface-800 space-y-4">
            <h3 className="text-base font-bold text-surface-100 flex items-center gap-2">
              <HiOutlinePlus className="w-5 h-5 text-teal-400" />
              <span>Add Platform FAQ</span>
            </h3>

            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1">Question</label>
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Can we export payroll to Excel?"
                required
                className="input-field text-xs h-10 bg-surface-900/60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1">Detailed Answer</label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Write the clear explanation..."
                required
                rows={3}
                className="input-field text-xs p-3 bg-surface-900/60 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={addingFaq}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>Publish FAQ</span>
            </button>
          </form>

          {/* Existing FAQs */}
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={f._id || i} className="liquid-glass p-5 rounded-2xl border border-surface-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-sm text-surface-100">
                      {i + 1}. {f.question}
                    </h4>
                    <p className="text-xs text-surface-400 leading-relaxed">{f.answer}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFaq(f._id)}
                    className="p-2 text-surface-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors flex-shrink-0"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: RAZORPAY GATEWAY SETTINGS ── */}
      {activeTab === 'gateway' && (
        <div className="space-y-6 max-w-2xl">
          <div className="liquid-glass p-6 rounded-3xl border border-teal-500/30 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <HiOutlineCreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-surface-100">Razorpay Checkout Configuration</h3>
                  <p className="text-xs text-surface-400">
                    Manage your live or test Razorpay API Key ID and Secret safely
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                  gatewayStatus.configured
                    ? gatewayStatus.mode === 'live'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {gatewayStatus.configured
                  ? gatewayStatus.mode === 'live'
                    ? '🟢 Live Mode'
                    : '🧪 Test Mode'
                  : '⚠️ Not Configured'}
              </span>
            </div>

            {gatewayStatus.configured && (
              <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Active Key ID:</span>
                  <span className="font-mono font-bold text-teal-400">{gatewayStatus.keyId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Secret Status:</span>
                  <span className="font-mono text-surface-300">{gatewayStatus.maskedSecret}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Config Source:</span>
                  <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-surface-800 text-surface-300">
                    {gatewayStatus.source}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveGateway} autoComplete="off" className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={rzpKeyId}
                  onChange={(e) => setRzpKeyId(e.target.value)}
                  placeholder="rzp_test_... or rzp_live_..."
                  required
                  className="input-field text-xs h-10 bg-surface-900/60 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={rzpKeySecret}
                  onChange={(e) => setRzpKeySecret(e.target.value)}
                  placeholder="Enter Razorpay Key Secret to update"
                  required
                  className="input-field text-xs h-10 bg-surface-900/60 font-mono"
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-[11px] text-surface-300">
                <HiOutlineShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0" />
                <span>
                  Credentials are verified directly with Razorpay API servers before activation so checkout stays uninterrupted.
                </span>
              </div>

              <button
                type="submit"
                disabled={savingGateway}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {savingGateway ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying with Razorpay...</span>
                  </>
                ) : (
                  <>
                    <HiOutlineCheck className="w-4 h-4" />
                    <span>Verify &amp; Save Razorpay Keys</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminCMS;

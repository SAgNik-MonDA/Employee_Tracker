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
  HiOutlineBookOpen,
  HiOutlinePencil,
  HiOutlineX,
  HiOutlineMail,
} from 'react-icons/hi';

const SuperAdminCMS = () => {
  const [activeTab, setActiveTab] = useState('pricing'); // 'pricing' | 'rules' | 'clients' | 'faqs' | 'gateway' | 'email'

  // Pricing Plans state
  const [pricing, setPricing] = useState({
    monthly: { price: 999, originalPrice: 1499, title: 'Monthly Flex', description: '' },
    yearly: { price: 9999, originalPrice: 15999, title: 'Annual Growth', description: '' },
    three_year: { price: 24999, originalPrice: 44999, title: '3-Year Enterprise', description: '' },
  });
  const [savingPricing, setSavingPricing] = useState(false);

  // Rules & Regulations state (Add, Edit, Delete)
  const [rules, setRules] = useState([]);
  const [ruleForm, setRuleForm] = useState({
    category: 'Salary',
    title: '',
    badgeText: '',
    summary: '',
    order: 1,
  });
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [savingRule, setSavingRule] = useState(false);

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

  // Email / SMTP / Port-443 Relay Config state
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailForm, setEmailForm] = useState({
    provider: 'smtp',
    host: 'smtp.gmail.com',
    port: 587,
    user: '',
    pass: '',
    fromEmail: '',
    brevoApiKey: '',
    resendApiKey: '',
    webhookUrl: '',
    webhookSecret: '',
  });
  const [testRecipient, setTestRecipient] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    fetchCMSData();
    fetchGatewayConfig();
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const { data } = await API.get('/subscription/email-config');
      if (data.success) {
        setEmailStatus(data);
        setEmailForm((prev) => ({
          ...prev,
          provider: data.preferredProvider || 'smtp',
          host: data.smtp?.host || 'smtp.gmail.com',
          port: data.smtp?.port || 587,
          user: data.smtp?.user || '',
          fromEmail: data.fromEmail || data.smtp?.user || '',
        }));
        if (!testRecipient && (data.fromEmail || data.smtp?.user)) {
          setTestRecipient(data.fromEmail || data.smtp?.user || '');
        }
      }
    } catch {
      // ignore initial load error
    }
  };

  const handleSaveEmailConfig = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const { data } = await API.put('/subscription/email-config', emailForm);
      setEmailStatus(data);
      setEmailForm((prev) => ({ ...prev, pass: '', brevoApiKey: '', resendApiKey: '', webhookSecret: '' }));
      toast.success(data.message || 'Email gateway configuration saved! ✉️');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleRunTestEmail = async () => {
    setTestingEmail(true);
    try {
      const { data } = await API.post('/subscription/test-email', { to: testRecipient });
      toast.success(data.message || 'Test email delivered!');
      fetchEmailConfig();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test email delivery failed', { duration: 7000 });
      fetchEmailConfig();
    } finally {
      setTestingEmail(false);
    }
  };

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
      if (Array.isArray(data.rulesAndRegulations)) {
        setRules(data.rulesAndRegulations);
        setRuleForm((prev) => ({ ...prev, order: data.rulesAndRegulations.length + 1 }));
      }
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

  // ── Rules & Regulations Handlers ─────────────────────────────────────────────
  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleForm({
      category: 'Salary',
      title: '',
      badgeText: '',
      summary: '',
      order: rules.length + 1,
    });
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.title.trim() || !ruleForm.summary.trim()) {
      toast.error('Rule title and details are required');
      return;
    }
    setSavingRule(true);
    try {
      if (editingRuleId) {
        const { data } = await API.put(`/landing/rules/${editingRuleId}`, ruleForm);
        toast.success(data.message || 'Rule updated successfully! ✏️');
        if (data.rulesAndRegulations) setRules(data.rulesAndRegulations);
      } else {
        const { data } = await API.post('/landing/rules', ruleForm);
        toast.success(data.message || 'Rule published! 📜');
        if (data.rulesAndRegulations) setRules(data.rulesAndRegulations);
      }
      resetRuleForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleEditRule = (rule) => {
    setEditingRuleId(rule._id);
    setRuleForm({
      category: rule.category || 'General',
      title: rule.title || '',
      badgeText: rule.badgeText || '',
      summary: rule.summary || '',
      order: rule.order || 1,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this rule from the Landing Page Rules & Regulations section?')) return;
    try {
      const { data } = await API.delete(`/landing/rules/${id}`);
      toast.success(data.message || 'Rule deleted! 🗑️');
      if (data.rulesAndRegulations) setRules(data.rulesAndRegulations);
      if (editingRuleId === id) resetRuleForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete rule');
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

  const tabBtnClass = (tab) =>
    `flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-bold rounded-full transition-all whitespace-nowrap cursor-pointer ${
      activeTab === tab
        ? 'bg-[#0F1115] dark:bg-[#D2F801] text-white dark:text-[#0B0D11] shadow-md'
        : 'text-surface-400 hover:text-surface-100'
    }`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display font-extrabold text-surface-100">
          Landing Page CMS Management
        </h2>
        <p className="text-xs sm:text-sm text-surface-400 mt-1">
          Dynamically modify the 3 subscription prices, manage rules &amp; regulations, client logo marquee, and platform FAQs
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl p-1.5 bg-surface-900 border border-surface-700 w-fit max-w-full">
        <button onClick={() => setActiveTab('pricing')} className={tabBtnClass('pricing')}>
          <HiOutlineTemplate className="w-4 h-4" />
          <span>Subscription Pricing Plans</span>
        </button>

        <button onClick={() => setActiveTab('rules')} className={tabBtnClass('rules')}>
          <HiOutlineBookOpen className="w-4 h-4" />
          <span>Rules &amp; Regulations</span>
        </button>

        <button onClick={() => setActiveTab('clients')} className={tabBtnClass('clients')}>
          <HiOutlineOfficeBuilding className="w-4 h-4" />
          <span>Client Logos Marquee</span>
        </button>

        <button onClick={() => setActiveTab('faqs')} className={tabBtnClass('faqs')}>
          <HiOutlineQuestionMarkCircle className="w-4 h-4" />
          <span>Questions &amp; Answers (FAQs)</span>
        </button>

        <button onClick={() => setActiveTab('gateway')} className={tabBtnClass('gateway')}>
          <HiOutlineCreditCard className="w-4 h-4" />
          <span>Razorpay Gateway</span>
        </button>

        <button onClick={() => setActiveTab('email')} className={tabBtnClass('email')}>
          <HiOutlineMail className="w-4 h-4" />
          <span>Email &amp; SMTP Relay</span>
        </button>
      </div>

      {/* ── TAB 1: PRICING PLANS ── */}
      {activeTab === 'pricing' && (
        <form onSubmit={handleSavePricing} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly */}
            <div className="liquid-glass rounded-3xl p-6 space-y-4">
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
                  className="input-field text-xs h-10"
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
                    className="input-field text-xs h-10 font-bold text-teal-400"
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
                    className="input-field text-xs h-10 text-surface-400"
                  />
                </div>
              </div>
            </div>

            {/* Yearly */}
            <div className="liquid-glass rounded-3xl p-6 border-2 border-[#D2F801] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-teal-400">2. Yearly Plan</h3>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#D2F801] text-[#0B0D11]">
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
                  className="input-field text-xs h-10"
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
                    className="input-field text-xs h-10 font-bold text-teal-400"
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
                    className="input-field text-xs h-10 text-surface-400"
                  />
                </div>
              </div>
            </div>

            {/* 3-Year Enterprise */}
            <div className="liquid-glass rounded-3xl p-6 border border-amber-400/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-amber-500 dark:text-amber-300">3. 3-Year Enterprise Plan</h3>
                <span className="text-[10px] font-extrabold text-[#0B0D11] px-2.5 py-0.5 rounded-full bg-amber-400">
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
                  className="input-field text-xs h-10"
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
                    className="input-field text-xs h-10 font-bold text-amber-500 dark:text-amber-300"
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
                    className="input-field text-xs h-10 text-surface-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPricing}
            className="btn-primary rounded-full px-7 py-3 flex items-center gap-2 text-sm"
          >
            {savingPricing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <HiOutlineCheck className="w-5 h-5" />
            )}
            <span>Save &amp; Publish Pricing Changes</span>
          </button>
        </form>
      )}

      {/* ── TAB 2: RULES & REGULATIONS CRUD ── */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveRule} className="liquid-glass p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-base font-bold text-surface-100 flex items-center gap-2">
                {editingRuleId ? (
                  <>
                    <HiOutlinePencil className="w-5 h-5 text-teal-400" />
                    <span>Edit Rule &amp; Regulation</span>
                  </>
                ) : (
                  <>
                    <HiOutlinePlus className="w-5 h-5 text-teal-400" />
                    <span>Add New Rule &amp; Regulation</span>
                  </>
                )}
              </h3>

              {editingRuleId && (
                <button
                  type="button"
                  onClick={resetRuleForm}
                  className="text-xs font-bold px-3 py-1.5 rounded-full bg-surface-700 text-surface-200 hover:bg-surface-600 flex items-center gap-1 cursor-pointer"
                >
                  <HiOutlineX className="w-3.5 h-3.5" />
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Rule Category</label>
                <select
                  value={ruleForm.category}
                  onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                  className="select-field text-xs h-10 py-2"
                >
                  <option value="Salary">Salary Rule</option>
                  <option value="Mediclaim">Mediclaim Rule</option>
                  <option value="PF">PF (Provident Fund) Rule</option>
                  <option value="Attendance">Attendance Rule</option>
                  <option value="General">General Governance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Policy Badge Tag</label>
                <input
                  type="text"
                  value={ruleForm.badgeText}
                  onChange={(e) => setRuleForm({ ...ruleForm, badgeText: e.target.value })}
                  placeholder="e.g. Mandatory Policy"
                  className="input-field text-xs h-10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1">Display Order</label>
                <input
                  type="number"
                  min={1}
                  value={ruleForm.order}
                  onChange={(e) => setRuleForm({ ...ruleForm, order: Number(e.target.value) })}
                  className="input-field text-xs h-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1">Rule Title *</label>
              <input
                type="text"
                value={ruleForm.title}
                onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                placeholder="e.g. Monthly Salary Payout & LOP Deduction Policy"
                required
                className="input-field text-xs h-10"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-300 mb-1">Rule Details / Policy Explanation *</label>
              <textarea
                value={ruleForm.summary}
                onChange={(e) => setRuleForm({ ...ruleForm, summary: e.target.value })}
                placeholder="Describe clear Salary, Mediclaim, PF, or Attendance rules shown on the public landing page..."
                required
                rows={3}
                className="input-field text-xs p-3 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingRule}
              className="btn-primary rounded-full px-6 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
            >
              {savingRule ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : editingRuleId ? (
                <HiOutlineCheck className="w-4 h-4" />
              ) : (
                <HiOutlinePlus className="w-4 h-4" />
              )}
              <span>{editingRuleId ? 'Update Rule' : 'Publish Rule'}</span>
            </button>
          </form>

          {/* Existing Rules List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((r, i) => (
              <div
                key={r._id || i}
                className={`liquid-glass p-5 rounded-3xl flex flex-col justify-between gap-4 ${
                  editingRuleId === r._id ? 'ring-2 ring-[#D2F801]' : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#D2F801] text-[#0B0D11] text-[10px] font-extrabold uppercase tracking-wider">
                      {r.category}
                    </span>
                    <span className="text-[11px] text-surface-400 font-semibold">
                      #{r.order || i + 1} • {r.badgeText || 'Policy'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-surface-100">{r.title}</h4>
                  <p className="text-xs text-surface-400 leading-relaxed">{r.summary}</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-700/60">
                  <button
                    type="button"
                    onClick={() => handleEditRule(r)}
                    className="px-3 py-1.5 rounded-full bg-surface-700 hover:bg-[#D2F801] hover:text-[#0B0D11] text-surface-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <HiOutlinePencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(r._id)}
                    className="px-3 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <HiOutlineTrash className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: CLIENT LOGOS ── */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          <form onSubmit={handleAddClient} className="liquid-glass p-6 rounded-3xl space-y-4">
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
                  className="input-field text-xs h-10"
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
                  className="input-field text-xs h-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingClient}
              className="btn-primary rounded-full px-5 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
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
                className="liquid-glass p-4 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D2F801] text-[#0B0D11] flex items-center justify-center font-extrabold">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-surface-100">{c.name}</h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteClient(c._id)}
                  className="p-2 text-surface-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/15 transition-colors cursor-pointer"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: FAQS MANAGEMENT ── */}
      {activeTab === 'faqs' && (
        <div className="space-y-6">
          <form onSubmit={handleAddFaq} className="liquid-glass p-6 rounded-3xl space-y-4">
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
                className="input-field text-xs h-10"
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
                className="input-field text-xs p-3 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={addingFaq}
              className="btn-primary rounded-full px-5 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>Publish FAQ</span>
            </button>
          </form>

          {/* Existing FAQs */}
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={f._id || i} className="liquid-glass p-5 rounded-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-sm text-surface-100">
                      {i + 1}. {f.question}
                    </h4>
                    <p className="text-xs text-surface-400 leading-relaxed">{f.answer}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteFaq(f._id)}
                    className="p-2 text-surface-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/15 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: RAZORPAY GATEWAY SETTINGS ── */}
      {activeTab === 'gateway' && (
        <div className="space-y-6 max-w-2xl">
          <div className="liquid-glass p-6 rounded-3xl space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center">
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
                      ? 'bg-lime-500/20 text-lime-700 dark:text-[#D2F801] border-lime-500/40'
                      : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
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
              <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-700 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-surface-400">Active Key ID:</span>
                  <span className="font-mono font-bold text-teal-400">{gatewayStatus.keyId}</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-surface-400">Secret Status:</span>
                  <span className="font-mono text-surface-300">{gatewayStatus.maskedSecret}</span>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
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
                  className="input-field text-xs h-10 font-mono"
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
                  className="input-field text-xs h-10 font-mono"
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-800/70 border border-surface-700 text-[11px] text-surface-300">
                <HiOutlineShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0" />
                <span>
                  Credentials are verified directly with Razorpay API servers before activation so checkout stays uninterrupted.
                </span>
              </div>

              <button
                type="submit"
                disabled={savingGateway}
                className="btn-primary rounded-full px-6 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
              >
                {savingGateway ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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

      {/* ── TAB 6: EMAIL & SMTP / PORT-443 RELAY DIAGNOSTICS ── */}
      {activeTab === 'email' && (
        <div className="space-y-6 max-w-3xl">
          <div className="liquid-glass p-6 rounded-3xl space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center">
                  <HiOutlineMail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-surface-100">Email &amp; SMTP Delivery Engine</h3>
                  <p className="text-xs text-surface-400">
                    Supports Direct IPv4 SMTP and Port-443 HTTPS Relays (works on Render Free Tier)
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#D2F801] text-[#0B0D11]">
                Active: {emailStatus?.preferredProvider || 'smtp'}
              </span>
            </div>

            {emailStatus?.lastDiagnostic?.timestamp && (
              <div
                className={`p-3.5 rounded-2xl border text-xs ${
                  emailStatus.lastDiagnostic.ok
                    ? 'bg-lime-500/10 border-lime-500/30 text-teal-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <div className="font-bold">
                  Last Server Dispatch ({emailStatus.lastDiagnostic.provider}):{' '}
                  {emailStatus.lastDiagnostic.ok ? 'Delivered ✅' : 'Failed ❌'}
                </div>
                {emailStatus.lastDiagnostic.error && (
                  <div className="mt-1 font-mono text-[11px] break-all">{emailStatus.lastDiagnostic.error}</div>
                )}
              </div>
            )}

            {/* Quick Live Server Email Test */}
            <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-700 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-surface-300 mb-1">
                  Run Live Delivery Test From Backend Server
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="recipient@gmail.com"
                  className="input-field text-xs h-10"
                />
              </div>
              <button
                type="button"
                onClick={handleRunTestEmail}
                disabled={testingEmail}
                className="btn-primary rounded-full px-5 h-10 text-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {testingEmail ? 'Sending Test...' : 'Send Live Test Email'}
              </button>
            </div>

            <form onSubmit={handleSaveEmailConfig} autoComplete="off" className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-300 mb-1.5">Transport Provider</label>
                <select
                  value={emailForm.provider}
                  onChange={(e) => setEmailForm({ ...emailForm, provider: e.target.value })}
                  className="select-field text-xs h-10 py-2"
                >
                  <option value="smtp">Direct IPv4 SMTP (Gmail / Custom Host — Paid Render or Local/VPS)</option>
                  <option value="brevo">Brevo HTTP API v3 (Port 443 — Bypasses Render Free Tier SMTP Block)</option>
                  <option value="resend">Resend HTTP API (Port 443 — Bypasses Render Free Tier SMTP Block)</option>
                  <option value="webhook">Google Apps Script / HTTPS Webhook Relay (Port 443 — Free Gmail)</option>
                </select>
              </div>

              {emailForm.provider === 'smtp' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={emailForm.host}
                      onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })}
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={emailForm.port}
                      onChange={(e) => setEmailForm({ ...emailForm, port: Number(e.target.value) })}
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">Gmail / SMTP Username</label>
                    <input
                      type="email"
                      value={emailForm.user}
                      onChange={(e) => setEmailForm({ ...emailForm, user: e.target.value })}
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">
                      App Password {emailStatus?.smtp?.maskedPass ? `(${emailStatus.smtp.maskedPass})` : ''}
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={emailForm.pass}
                      onChange={(e) => setEmailForm({ ...emailForm, pass: e.target.value })}
                      placeholder="Leave blank to keep existing password"
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                </div>
              )}

              {emailForm.provider === 'brevo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">Sender Email (Verified in Brevo)</label>
                    <input
                      type="email"
                      value={emailForm.fromEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                      placeholder="sagnikm997@gmail.com"
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">
                      Brevo v3 API Key {emailStatus?.httpRelays?.brevoMaskedKey ? `(${emailStatus.httpRelays.brevoMaskedKey})` : ''}
                    </label>
                    <input
                      type="password"
                      value={emailForm.brevoApiKey}
                      onChange={(e) => setEmailForm({ ...emailForm, brevoApiKey: e.target.value })}
                      placeholder="xkeysib-..."
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                </div>
              )}

              {emailForm.provider === 'resend' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">Sender Email (Optional Verified Domain)</label>
                    <input
                      type="email"
                      value={emailForm.fromEmail}
                      onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                      placeholder="noreply@yourdomain.com"
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-surface-300 mb-1">
                      Resend API Key {emailStatus?.httpRelays?.resendMaskedKey ? `(${emailStatus.httpRelays.resendMaskedKey})` : ''}
                    </label>
                    <input
                      type="password"
                      value={emailForm.resendApiKey}
                      onChange={(e) => setEmailForm({ ...emailForm, resendApiKey: e.target.value })}
                      placeholder="re_..."
                      className="input-field text-xs h-10 font-mono"
                    />
                  </div>
                </div>
              )}

              {emailForm.provider === 'webhook' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-surface-300 mb-1">HTTPS Webhook / Apps Script URL</label>
                      <input
                        type="url"
                        value={emailForm.webhookUrl}
                        onChange={(e) => setEmailForm({ ...emailForm, webhookUrl: e.target.value })}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="input-field text-xs h-10 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-surface-300 mb-1">Shared Secret Token (Optional)</label>
                      <input
                        type="password"
                        value={emailForm.webhookSecret}
                        onChange={(e) => setEmailForm({ ...emailForm, webhookSecret: e.target.value })}
                        placeholder="Optional shared secret"
                        className="input-field text-xs h-10 font-mono"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900/70 border border-surface-700 text-[11px] text-surface-400">
                    Deploy a Google Apps Script Web App (`doPost`) bound to your Gmail to relay HTML + PDF attachments over HTTPS Port 443 with zero Render SMTP blocks.
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingEmail}
                className="btn-primary rounded-full px-6 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
              >
                <HiOutlineCheck className="w-4 h-4" />
                <span>{savingEmail ? 'Saving...' : 'Save Email Gateway Settings'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminCMS;

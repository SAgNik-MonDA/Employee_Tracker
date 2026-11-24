import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import {
  HiOutlineSparkles,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineIdentification,
  HiOutlineQrcode,
  HiOutlineCash,
  HiOutlineDocumentReport,
  HiOutlineShieldCheck,
  HiOutlineClock,
  HiOutlineUserGroup,
  HiOutlineCheckCircle,
  HiOutlineChevronDown,
  HiOutlineMail,
  HiOutlineOfficeBuilding,
  HiOutlineChatAlt2,
  HiOutlineLockClosed,
  HiOutlineArrowRight,
  HiStar,
} from 'react-icons/hi';
import LoginIllustration from '../components/auth/LoginIllustration';
import LoginModal from '../components/auth/LoginModal';
import SubscribeModal from '../components/subscription/SubscribeModal';
import ReviewModal from '../components/landing/ReviewModal';

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme();

  // Modals state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedPlanForSubscribe, setSelectedPlanForSubscribe] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Dynamic CMS & Live Stats state
  const [pricingPlans, setPricingPlans] = useState({
    monthly: {
      price: 999,
      originalPrice: 1499,
      title: 'Monthly Flex',
      description: 'Month-to-month dynamic workforce management',
      billingCycle: 'per month',
      features: [
        'All Enterprise HRMS Features',
        'AI Biometric Face & QR Attendance',
        'Automated PF & Mediclaim Deductions',
        'Up to 50 Active Employees',
        'Standard Email Support',
        'Full Data Encryption',
      ],
    },
    yearly: {
      price: 9999,
      originalPrice: 15999,
      title: 'Annual Growth',
      description: 'Best choice for growing corporate enterprise teams',
      billingCycle: 'per year',
      isPopular: true,
      features: [
        'Everything in Monthly Flex Plan',
        'Up to 250 Active Employees',
        'Finance Bank Transfer Advice (PDF/Excel)',
        'Multi-Shift Rostering & Geo-Fencing Tracking',
        'Priority 24/7 Enterprise Support',
        '2 Months Free (Save 38%)',
      ],
    },
    three_year: {
      price: 24999,
      originalPrice: 44999,
      title: '3-Year Enterprise',
      description: 'Maximum long-term corporate savings with zero rate hikes',
      billingCycle: 'for 3 years',
      badge: 'Best Value',
      features: [
        'Everything in Annual Growth Plan',
        'Unlimited Employees & Shifts',
        'Dedicated Enterprise Account Manager',
        'Custom Cloud Backups & Enterprise SLA',
        'Zero Price Increase Guarantee for 3 Years',
        'Over 45% Massive Direct Savings!',
      ],
    },
  });

  const [clients, setClients] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState({
    totalVisitors: 1250,
    totalSubscriptions: 24,
    totalReviews: 12,
  });

  // Accordion FAQ state: ID of open FAQ
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // Contact Form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);

  useEffect(() => {
    // 1. Automatically increment visitor counter
    API.post('/landing/track-visitor').catch(() => {});

    // 2. Fetch landing CMS content & live stats
    fetchLandingData();
  }, []);

  const fetchLandingData = async () => {
    try {
      const { data } = await API.get('/landing/public-content');
      if (data.pricingPlans) setPricingPlans(data.pricingPlans);
      if (data.clients) setClients(data.clients);
      if (data.faqs) setFaqs(data.faqs);
      if (data.testimonials) setTestimonials(data.testimonials);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to load landing content:', err);
    }
  };

  const handleOpenSubscribe = (planId) => {
    const plan = pricingPlans[planId];
    if (plan) {
      setSelectedPlanForSubscribe({ id: planId, ...plan });
      setShowSubscribeModal(true);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      toast.error('Please fill in name, email and message');
      return;
    }
    setContactSending(true);
    try {
      const { data } = await API.post('/landing/contact', {
        name: contactName,
        email: contactEmail,
        subject: contactSubject || 'Platform Inquiry',
        message: contactMessage,
      });
      toast.success(data.message || 'Message sent! Our executive team will reply to your email.');
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit message');
    } finally {
      setContactSending(false);
    }
  };

  const servicesList = [
    {
      title: 'Biometric Face & QR Check-In',
      icon: <HiOutlineQrcode className="w-6 h-6 text-teal-300" />,
      color: 'from-teal-800 to-teal-950',
      description: '128D AI biometric facial recognition and dynamic QR badges prevent buddy punching with automated checkout and penalty tracking.',
      tag: 'AI Biometrics',
    },
    {
      title: 'Automated PF & Mediclaim Engine',
      icon: <HiOutlineCash className="w-6 h-6 text-amber-300" />,
      color: 'from-amber-700 to-amber-950',
      description: 'Runs on the 2nd of each month at 00:05 AM IST. Calculates 12% statutory PF and Mediclaim deductions with instant employee email advice.',
      tag: 'Statutory Payroll',
    },
    {
      title: 'Finance Bank Transfer Advice',
      icon: <HiOutlineDocumentReport className="w-6 h-6 text-emerald-300" />,
      color: 'from-emerald-700 to-emerald-950',
      description: 'One-click landscape PDF and formatted Excel schedules with employee bank names, account numbers, and IFSC codes for direct payout disbursement.',
      tag: 'Direct Payout',
    },
    {
      title: 'Multi-Shift Rostering & Geo-Fencing',
      icon: <HiOutlineClock className="w-6 h-6 text-cyan-300" />,
      color: 'from-cyan-800 to-cyan-950',
      description: 'Configure morning, general, and night shifts with GPS radius verification, automated early-departure detection, and holiday scheduling.',
      tag: 'Smart Rosters',
    },
    {
      title: 'Disciplinary & Leave Workflows',
      icon: <HiOutlineShieldCheck className="w-6 h-6 text-rose-300" />,
      color: 'from-rose-800 to-rose-950',
      description: 'Multi-tiered leave approval pipelines with medical document verification, monthly quotas, and admin biometric reset authorization.',
      tag: 'Governance',
    },
    {
      title: 'Encrypted Sockets & Real-Time Chat',
      icon: <HiOutlineUserGroup className="w-6 h-6 text-purple-300" />,
      color: 'from-purple-800 to-purple-950',
      description: 'WebSocket-powered team channels, broadcast alerts, live presence indicators, and virtual video conference rooms with screen sharing.',
      tag: 'Real-Time Sync',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex flex-col relative overflow-x-hidden">
      {/* ── Background Gradients & Glows ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* ── 1. STICKY TOP NAVIGATION BAR ── */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-surface-950/75 border-b border-surface-800/80 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-700 via-teal-800 to-teal-950 border border-teal-400/30 flex items-center justify-center text-white shadow-lg shadow-teal-950/40">
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-surface-100">
                  Employee Tracker
                </span>
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 text-teal-950 shadow-sm">
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 block -mt-1 tracking-wider uppercase">
                Enterprise Attendance &amp; Payroll
              </span>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-surface-300">
            <a href="#services" className="hover:text-teal-400 transition-colors">Services</a>
            <a href="#clients" className="hover:text-teal-400 transition-colors">Clients</a>
            <a href="#pricing" className="hover:text-teal-400 transition-colors">Pricing Plans</a>
            <a href="#reviews" className="hover:text-teal-400 transition-colors">Testimonials</a>
            <a href="#faqs" className="hover:text-teal-400 transition-colors">FAQs</a>
            <a href="#contact" className="hover:text-teal-400 transition-colors">Contact</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Live Visitor Counter Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass text-xs text-teal-700 dark:text-teal-300 font-semibold border border-teal-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{stats.totalVisitors?.toLocaleString()}+ Live Visitors</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl liquid-glass text-surface-300 hover:text-surface-100 transition-all duration-300 shadow-md hover:scale-105"
              aria-label="Toggle theme"
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

            {/* Prominent "Sign In" Button */}
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-4.5 py-2.5 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-teal-950/40 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer"
            >
              <HiOutlineIdentification className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION ── */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Headline & Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 dark:liquid-glass-teal text-xs font-bold text-teal-700 dark:text-teal-200 border border-teal-500/30 shadow-md">
              <HiOutlineSparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>ENTERPRISE WORKFORCE &amp; STATUTORY PAYROLL</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-black text-surface-100 tracking-tight leading-[1.1]">
                SMART ATTENDANCE <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-500 to-amber-500 dark:from-teal-300 dark:via-emerald-400 dark:to-amber-300">
                  &amp; PAYROLL SUITE
                </span>
              </h1>
              <p className="text-base sm:text-lg font-semibold text-surface-200 leading-snug">
                Automated biometric attendance, monthly PF &amp; Mediclaim deductions, and instant bank payout advice.
              </p>
              <p className="text-xs sm:text-sm font-medium text-surface-400 leading-relaxed max-w-2xl">
                Scheduled auto-deductions every 2nd of the month with dual payroll generation (bulk &amp; manual) and one-click finance bank transfer schedules.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#pricing"
                className="px-6 py-3.5 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-xl shadow-teal-950/40 hover:scale-105 transition-all text-sm flex items-center gap-2"
              >
                <span>⚡ View Subscription Plans</span>
                <HiOutlineArrowRight className="w-4 h-4" />
              </a>

              <button
                onClick={() => setShowLoginModal(true)}
                className="px-6 py-3.5 liquid-glass hover:bg-surface-800/80 text-surface-200 font-bold rounded-xl border border-teal-500/30 transition-all text-sm flex items-center gap-2 cursor-pointer"
              >
                <span>🚀 Sign In to Workspace</span>
              </button>
            </div>

            {/* Mini Trust Badges */}
            <div className="flex items-center gap-4 text-xs text-surface-400 pt-2">
              <span className="flex items-center gap-1.5">
                <HiOutlineCheckCircle className="w-4 h-4 text-teal-400" />
                <span>Zero Setup Fees</span>
              </span>
              <span className="flex items-center gap-1.5">
                <HiOutlineCheckCircle className="w-4 h-4 text-teal-400" />
                <span>Encrypted Razorpay Gateway</span>
              </span>
              <span className="flex items-center gap-1.5">
                <HiOutlineCheckCircle className="w-4 h-4 text-teal-400" />
                <span>Tenant Isolation</span>
              </span>
            </div>
          </div>

          {/* Right Column: Hero Illustration Graphic */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md">
              <LoginIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. LIVE COUNTER & METRICS SECTION ── */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Visitors */}
          <div className="liquid-glass p-6 rounded-3xl border border-teal-500/30 shadow-xl relative overflow-hidden group hover:border-teal-400 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-teal-400">Total System Visits</p>
                <h3 className="text-3xl sm:text-4xl font-display font-black text-surface-100 mt-1">
                  {stats.totalVisitors?.toLocaleString()}+
                </h3>
                <p className="text-[11px] text-surface-400 mt-1">Live organic traffic tracked dynamically</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300 text-2xl group-hover:scale-110 transition-transform">
                🌐
              </div>
            </div>
          </div>

          {/* Card 2: Subscribed Companies */}
          <div className="liquid-glass p-6 rounded-3xl border border-emerald-500/30 shadow-xl relative overflow-hidden group hover:border-emerald-400 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Subscribed Enterprises</p>
                <h3 className="text-3xl sm:text-4xl font-display font-black text-surface-100 mt-1">
                  {stats.totalSubscriptions}+
                </h3>
                <p className="text-[11px] text-surface-400 mt-1">Active organizations &amp; businesses</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-2xl group-hover:scale-110 transition-transform">
                🏢
              </div>
            </div>
          </div>

          {/* Card 3: Client Reviews */}
          <div className="liquid-glass p-6 rounded-3xl border border-amber-500/30 shadow-xl relative overflow-hidden group hover:border-amber-400 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Verified Reviews</p>
                <h3 className="text-3xl sm:text-4xl font-display font-black text-surface-100 mt-1">
                  {stats.totalReviews}+
                </h3>
                <p className="text-[11px] text-surface-400 mt-1">Average 4.95 / 5.0 customer satisfaction</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 text-2xl group-hover:scale-110 transition-transform">
                ⭐
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. OUR SERVICES SECTION ── */}
      <section id="services" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs font-bold uppercase tracking-wider">
            Enterprise Solutions
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-surface-100 tracking-tight">
            Comprehensive HR, Attendance &amp; Payroll Engine
          </h2>
          <p className="text-sm sm:text-base text-surface-400 leading-relaxed">
            From facial biometrics to automated PF calculations and direct finance bank disbursement, Employee Tracker powers modern corporate operations end-to-end.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicesList.map((srv, idx) => (
            <div
              key={idx}
              className="liquid-glass p-6 rounded-3xl border border-teal-500/30 hover:border-teal-400 transition-all duration-300 group hover:-translate-y-1.5 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${srv.color} border border-teal-400/30 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    {srv.icon}
                  </div>
                  <span className="text-[11px] font-bold text-teal-400 px-2.5 py-0.5 rounded-full bg-teal-950/60 border border-teal-500/30">
                    {srv.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold text-surface-100 mb-2">{srv.title}</h3>
                <p className="text-xs text-surface-400 leading-relaxed">{srv.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. OUR CLIENTS INFINITE LOOP MARQUEE SECTION ── */}
      <section id="clients" className="relative z-10 w-full py-12 bg-surface-900/40 border-y border-surface-800/80 overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-teal-400">
            TRUSTED BY FORWARD-THINKING ENTERPRISES &amp; ORGANIZATIONS
          </p>
        </div>

        {/* Marquee Track with infinite CSS animation */}
        <div className="relative w-full overflow-hidden mask-gradient">
          <div className="animate-marquee flex items-center gap-10 whitespace-nowrap">
            {/* Repeat list twice for continuous seamless infinite loop */}
            {[...(clients.length > 0 ? clients : [
              { name: 'TechFlow Global' },
              { name: 'Nexus Enterprise' },
              { name: 'Apex Solutions' },
              { name: 'Vanguard Systems' },
              { name: 'Starlight Financial' },
              { name: 'Alpha Horizon' },
            ]), ...(clients.length > 0 ? clients : [
              { name: 'TechFlow Global' },
              { name: 'Nexus Enterprise' },
              { name: 'Apex Solutions' },
              { name: 'Vanguard Systems' },
              { name: 'Starlight Financial' },
              { name: 'Alpha Horizon' },
            ])].map((client, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl liquid-glass border border-teal-500/20 hover:border-teal-400 transition-colors shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-900 border border-teal-400/30 flex items-center justify-center text-teal-200 text-sm font-bold shadow-sm">
                  {client.name.charAt(0)}
                </div>
                <span className="font-bold text-xs sm:text-sm text-surface-200">{client.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING & SUBSCRIPTION PLANS (3 CARDS) ── */}
      <section id="pricing" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
            💎 Subscription Plans
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-surface-100 tracking-tight">
            Transparent, Pay-As-You-Grow Pricing
          </h2>
          <p className="text-sm sm:text-base text-surface-400 leading-relaxed">
            Instant online activation via Razorpay. Upgrade, renew, or switch plans anytime with zero data loss.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* Card 1: Monthly Plan */}
          <div className="liquid-glass rounded-3xl p-7 border border-teal-500/30 flex flex-col justify-between hover:border-teal-400 transition-all duration-300 group hover:-translate-y-1.5 shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-400">
                  {pricingPlans.monthly?.title || 'Monthly Flex'}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-surface-800 text-surface-400 font-semibold border border-surface-700">
                  Standard
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-display font-black text-surface-100">
                    ₹{pricingPlans.monthly?.price?.toLocaleString()}
                  </span>
                  <span className="text-xs text-surface-400 font-medium">/ month</span>
                </div>
                {pricingPlans.monthly?.originalPrice && (
                  <p className="text-xs text-surface-500 line-through mt-0.5">
                    ₹{pricingPlans.monthly?.originalPrice?.toLocaleString()} regular rate
                  </p>
                )}
              </div>

              <p className="text-xs text-surface-400 mb-6 leading-relaxed">
                {pricingPlans.monthly?.description}
              </p>

              <div className="space-y-3 border-t border-surface-800/80 pt-5 mb-8">
                {pricingPlans.monthly?.features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-surface-300">
                    <HiOutlineCheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe('monthly')}
              className="w-full py-3 bg-surface-800 hover:bg-teal-700 text-teal-200 hover:text-white border border-teal-500/30 hover:border-teal-400 font-bold rounded-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Subscribe Monthly</span>
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Yearly Plan (Featured / Popular) */}
          <div className="liquid-glass rounded-3xl p-7 border-2 border-emerald-500/60 dark:border-emerald-400/60 flex flex-col justify-between hover:border-emerald-300 transition-all duration-300 group hover:-translate-y-2 shadow-2xl relative">
            {/* Most Popular Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-teal-950 font-black text-[11px] tracking-wider uppercase shadow-lg shadow-emerald-950/40">
              ⭐ Most Popular • Save 38%
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  {pricingPlans.yearly?.title || 'Annual Growth'}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  2 Months Free
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-display font-black text-emerald-400">
                    ₹{pricingPlans.yearly?.price?.toLocaleString()}
                  </span>
                  <span className="text-xs text-surface-400 font-medium">/ year</span>
                </div>
                {pricingPlans.yearly?.originalPrice && (
                  <p className="text-xs text-surface-500 line-through mt-0.5">
                    ₹{pricingPlans.yearly?.originalPrice?.toLocaleString()} regular rate
                  </p>
                )}
              </div>

              <p className="text-xs text-surface-400 mb-6 leading-relaxed">
                {pricingPlans.yearly?.description}
              </p>

              <div className="space-y-3 border-t border-surface-800/80 pt-5 mb-8">
                {pricingPlans.yearly?.features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-surface-200">
                    <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe('yearly')}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black rounded-xl shadow-xl shadow-emerald-950/40 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-105"
            >
              <span>Subscribe Yearly &amp; Save</span>
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: 3-Year Enterprise Plan */}
          <div className="liquid-glass rounded-3xl p-7 border border-amber-500/40 flex flex-col justify-between hover:border-amber-400 transition-all duration-300 group hover:-translate-y-1.5 shadow-xl relative">
            {/* Best Value Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[11px] tracking-wider uppercase shadow-lg shadow-amber-950/40">
              👑 Maximum Savings • Over 45% Off
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  {pricingPlans.three_year?.title || '3-Year Enterprise'}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Zero Rate Hikes
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-display font-black text-amber-300">
                    ₹{pricingPlans.three_year?.price?.toLocaleString()}
                  </span>
                  <span className="text-xs text-surface-400 font-medium">for 3 years</span>
                </div>
                {pricingPlans.three_year?.originalPrice && (
                  <p className="text-xs text-surface-500 line-through mt-0.5">
                    ₹{pricingPlans.three_year?.originalPrice?.toLocaleString()} regular rate
                  </p>
                )}
              </div>

              <p className="text-xs text-surface-400 mb-6 leading-relaxed">
                {pricingPlans.three_year?.description}
              </p>

              <div className="space-y-3 border-t border-surface-800/80 pt-5 mb-8">
                {pricingPlans.three_year?.features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-surface-300">
                    <HiOutlineCheckCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe('three_year')}
              className="w-full py-3.5 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-black rounded-xl shadow-xl shadow-amber-950/40 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-105"
            >
              <span>Get 3-Year Enterprise</span>
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. TESTIMONIALS & FEEDBACK SECTION ── */}
      <section id="reviews" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              Customer Voices
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-surface-100 tracking-tight">
              Trusted by Hundreds of HR Leaders
            </h2>
            <p className="text-xs sm:text-sm text-surface-400 mt-1">
              Read authentic feedback from enterprises running their daily attendance &amp; payroll on our system.
            </p>
          </div>

          <button
            onClick={() => setShowReviewModal(true)}
            className="px-5 py-2.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <span>✍️ Write a Review</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="liquid-glass p-6 rounded-3xl border border-teal-500/30 shadow-xl flex flex-col justify-between hover:border-teal-400 transition-all"
            >
              <div>
                {/* 5-Star Rating */}
                <div className="flex items-center gap-1 text-amber-400 mb-3">
                  {[...Array(t.rating || 5)].map((_, i) => (
                    <HiStar key={i} className="w-4 h-4" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-surface-300 italic leading-relaxed mb-6">
                  "{t.comment}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-surface-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-700 to-emerald-900 border border-teal-400/40 flex items-center justify-center text-white font-bold text-sm">
                  {t.name?.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-surface-100">{t.name}</h4>
                  <p className="text-[11px] text-teal-400">{t.role} • {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. QUERY & FAQ ACCORDION SECTION ── */}
      <section id="faqs" className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs font-bold uppercase tracking-wider">
            Clear Answers
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-surface-100 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-surface-400">
            Everything you need to know about attendance rules, auto-deductions, and subscription billing.
          </p>
        </div>

        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="liquid-glass rounded-2xl border border-teal-500/30 overflow-hidden transition-all duration-300"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-surface-100 hover:text-teal-300 transition-colors cursor-pointer"
                >
                  <span className="flex-1">{faq.question}</span>
                  <HiOutlineChevronDown
                    className={`w-5 h-5 text-teal-400 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-surface-400 leading-relaxed border-t border-surface-800/60 animate-fade-in">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 9. CONTACT US SECTION ── */}
      <section id="contact" className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <div className="liquid-glass rounded-3xl p-8 sm:p-10 border border-teal-500/40 shadow-2xl relative overflow-hidden">
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-surface-100">
              Need Corporate Assistance? Contact Us
            </h2>
            <p className="text-xs sm:text-sm text-surface-400">
              Have questions regarding statutory compliance, bank integration, or enterprise customization? Fill in the form and our executive team will email you back promptly.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                  Your Full Name <span className="text-teal-400">*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Sagnik Mondal"
                  required
                  className="input-field text-sm h-11 bg-surface-900/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                  Work Email Address <span className="text-teal-400">*</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="input-field text-sm h-11 bg-surface-900/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                placeholder="e.g. Multi-Tenant Enterprise Inquiry"
                className="input-field text-sm h-11 bg-surface-900/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                Message / Details <span className="text-teal-400">*</span>
              </label>
              <textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your company requirements, employee size, or specific inquiries..."
                required
                rows={4}
                className="input-field text-sm p-3.5 bg-surface-900/50 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={contactSending}
              className="w-full h-12 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-xl shadow-teal-950/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
            >
              {contactSending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <HiOutlineMail className="w-5 h-5" />
                  <span>Send Inquiry to Executive Team</span>
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* ── 10. ENTERPRISE FOOTER ── */}
      <footer className="relative z-10 w-full bg-surface-950 border-t border-surface-800/80 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-surface-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-700 to-teal-950 border border-teal-400/30 flex items-center justify-center text-white font-bold">
              ⚡
            </div>
            <div>
              <span className="font-bold text-surface-200">Employee Tracker PRO</span>
              <span className="block text-[10px] text-surface-500">
                © 2026 Employee Tracker Enterprise HRMS. All rights reserved.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#services" className="hover:text-teal-400 transition-colors">Services</a>
            <a href="#pricing" className="hover:text-teal-400 transition-colors">Subscription Pricing</a>
            <a href="#faqs" className="hover:text-teal-400 transition-colors">Compliance FAQ</a>
            <button onClick={() => setShowLoginModal(true)} className="text-teal-400 hover:underline font-bold">
              Workspace Login
            </button>
          </div>
        </div>
      </footer>

      {/* ── MODALS ── */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <SubscribeModal
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        selectedPlan={selectedPlanForSubscribe}
      />
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onReviewSubmitted={(newRev) => {
          setTestimonials((prev) => [newRev, ...prev]);
          setStats((prev) => ({ ...prev, totalReviews: prev.totalReviews + 1 }));
        }}
      />
    </div>
  );
};

export default LandingPage;

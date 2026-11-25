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
  HiOutlineArrowRight,
  HiOutlineBookOpen,
  HiOutlineHeart,
  HiOutlineCurrencyRupee,
  HiOutlineMenuAlt3,
  HiOutlineX,
  HiStar,
} from 'react-icons/hi';
import LoginModal from '../components/auth/LoginModal';
import SubscribeModal from '../components/subscription/SubscribeModal';
import ReviewModal from '../components/landing/ReviewModal';
import BrandLogo from '../components/common/BrandLogo';
import analyticsDeskImg from '../assets/images/analytics_desk.jpg';
import teamCollabImg from '../assets/images/team_collab.jpg';
import officeDiscussionImg from '../assets/images/office_discussion.jpg';

const DEFAULT_RULES = [
  {
    _id: 'default-salary',
    category: 'Salary',
    title: 'Monthly Salary Cycle, LOP & Bank Disbursement Rules',
    summary:
      'Salaries are processed automatically on the 2nd of each month at 00:05 AM IST via bulk or manual payroll generation. Unapproved absences or unregularized late check-ins incur prorated Loss of Pay (LOP) deductions, and verified payouts are exported with IFSC and bank account advice schedules.',
    badgeText: 'Payroll Cycle',
    order: 1,
  },
  {
    _id: 'default-mediclaim',
    category: 'Mediclaim',
    title: 'Corporate Mediclaim Policy & Reimbursement Claims',
    summary:
      'Every active employee receives an encrypted corporate Mediclaim ID synced with monthly statutory payroll deductions. Reimbursement or emergency hospitalization claims require supporting medical invoices reviewed by Finance/HR, generating an auditable settlement payslip PDF.',
    badgeText: 'Health Cover',
    order: 2,
  },
  {
    _id: 'default-pf',
    category: 'PF',
    title: 'Statutory Provident Fund (PF) & Withdrawal Governance',
    summary:
      'A statutory 12% Provident Fund deduction is calculated per salary cycle and accumulated in each employee’s isolated PF fund ledger. Partial or emergency PF withdrawal requests undergo two-step Admin approval with automated fund deduction and email receipt advice.',
    badgeText: '12% EPF Rule',
    order: 3,
  },
  {
    _id: 'default-attendance',
    category: 'Attendance',
    title: 'AI Biometric Face, QR Badge & Shift Punctuality Rules',
    summary:
      'Daily attendance requires 128D facial verification or dynamic QR scan within assigned shift windows (Morning, General, Evening, Night) with GPS check-in validation. Early check-outs prior to shift completion require mandatory reason submission and manager approval.',
    badgeText: 'Biometric Policy',
    order: 4,
  },
  {
    _id: 'default-general',
    category: 'General',
    title: 'Leave Quotas, Paid Holidays & Multi-Tenant Privacy',
    summary:
      'Annual leave balances (Casual, Sick, Earned) follow organization-level designation quotas and declared holiday calendars. Each subscribed organization operates in a strictly isolated tenant scope—zero employee payroll or biometric records are ever visible across companies.',
    badgeText: 'Zero-Trust SLA',
    order: 5,
  },
];

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  // Navigation drawer on mobile/tablet
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [activeRuleCategory, setActiveRuleCategory] = useState('All');
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
    API.post('/landing/track-visitor').catch(() => {});
    fetchLandingData();
  }, []);

  const fetchLandingData = async () => {
    try {
      const { data } = await API.get('/landing/public-content');
      if (data.pricingPlans) setPricingPlans(data.pricingPlans);
      if (data.clients) setClients(data.clients);
      if (data.faqs) setFaqs(data.faqs);
      if (Array.isArray(data.rulesAndRegulations)) {
        setRules(data.rulesAndRegulations);
      }
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
      icon: <HiOutlineQrcode className="w-5 h-5" />,
      description: '128D AI biometric facial recognition and dynamic QR badges prevent buddy punching with automated checkout and penalty tracking.',
      tag: 'AI Biometrics',
    },
    {
      title: 'Automated PF & Mediclaim Engine',
      icon: <HiOutlineCash className="w-5 h-5" />,
      description: 'Runs on the 2nd of each month at 00:05 AM IST. Calculates 12% statutory PF and Mediclaim deductions with instant employee email advice.',
      tag: 'Statutory Payroll',
    },
    {
      title: 'Finance Bank Transfer Advice',
      icon: <HiOutlineDocumentReport className="w-5 h-5" />,
      description: 'One-click landscape PDF and formatted Excel schedules with employee bank names, account numbers, and IFSC codes for direct payout disbursement.',
      tag: 'Direct Payout',
    },
    {
      title: 'Multi-Shift Rostering & Geo-Fencing',
      icon: <HiOutlineClock className="w-5 h-5" />,
      description: 'Configure morning, general, and night shifts with GPS radius verification, automated early-departure detection, and holiday scheduling.',
      tag: 'Smart Rosters',
    },
    {
      title: 'Disciplinary & Leave Workflows',
      icon: <HiOutlineShieldCheck className="w-5 h-5" />,
      description: 'Multi-tiered leave approval pipelines with medical document verification, monthly quotas, and admin biometric reset authorization.',
      tag: 'Governance',
    },
    {
      title: 'Encrypted Sockets & Real-Time Chat',
      icon: <HiOutlineUserGroup className="w-5 h-5" />,
      description: 'WebSocket-powered team channels, broadcast alerts, live presence indicators, and virtual video conference rooms with screen sharing.',
      tag: 'Real-Time Sync',
    },
  ];

  const ruleCategories = ['All', 'Salary', 'Mediclaim', 'PF', 'Attendance', 'General'];
  const filteredRules =
    activeRuleCategory === 'All'
      ? rules
      : rules.filter((r) => (r.category || 'General').toLowerCase() === activeRuleCategory.toLowerCase());

  const getRuleIcon = (category) => {
    switch (category) {
      case 'Salary':
        return <HiOutlineCurrencyRupee className="w-5 h-5" />;
      case 'Mediclaim':
        return <HiOutlineHeart className="w-5 h-5" />;
      case 'PF':
        return <HiOutlineShieldCheck className="w-5 h-5" />;
      case 'Attendance':
        return <HiOutlineQrcode className="w-5 h-5" />;
      default:
        return <HiOutlineBookOpen className="w-5 h-5" />;
    }
  };

  return (
    <div
      className={`min-h-screen font-sans flex flex-col relative overflow-x-hidden transition-colors duration-300 ${
        isLight ? 'bg-white text-[#0F1115]' : 'bg-[#090A0D] text-white'
      }`}
    >
      {/* ── Ambient Subtle Accents ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className={`absolute -top-44 -right-32 w-[480px] h-[480px] rounded-full blur-3xl ${
            isLight ? 'bg-[#D2F801]/20' : 'bg-[#D2F801]/10'
          }`}
        />
        <div
          className={`absolute bottom-10 -left-40 w-[420px] h-[420px] rounded-full blur-3xl ${
            isLight ? 'bg-lime-200/30' : 'bg-[#D2F801]/[0.06]'
          }`}
        />
      </div>

      {/* ── 1. STICKY TOP NAVIGATION BAR ── */}
      <header
        className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b transition-colors ${
          isLight
            ? 'bg-white/90 border-neutral-200/80'
            : 'bg-[#090A0D]/85 border-neutral-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <a href="#" className="flex items-center min-w-0">
            <BrandLogo />
          </a>

          {/* Center Links (Desktop) */}
          <nav
            className={`hidden lg:flex items-center gap-6 text-xs font-semibold ${
              isLight ? 'text-neutral-600' : 'text-neutral-300'
            }`}
          >
            <a href="#services" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">Services</a>
            <a href="#rules" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">Rules &amp; Regulation</a>
            <a href="#clients" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">Clients</a>
            <a href="#pricing" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">Pricing Plans</a>
            <a href="#reviews" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">Testimonials</a>
            <a href="#faqs" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">FAQs</a>
            <a href="#contact" className="hover:text-[#0F1115] dark:hover:text-[#D2F801] transition-colors">Contact</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Live Visitor Counter Badge */}
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isLight
                  ? 'bg-[#F4F5F7] text-[#0F1115] border-neutral-200'
                  : 'bg-[#151820] text-[#D2F801] border-[#262B36]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#84CC16] animate-pulse" />
              <span>{stats.totalVisitors?.toLocaleString()}+ Live Visitors</span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-full border transition-all duration-300 hover:scale-105 cursor-pointer ${
                isLight
                  ? 'bg-[#F4F5F7] border-neutral-200 text-[#0F1115] hover:bg-neutral-200'
                  : 'bg-[#151820] border-[#272C37] text-[#D2F801] hover:border-[#D2F801]/50'
              }`}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <div className="relative w-4 h-4 sm:w-5 sm:h-5">
                <HiOutlineSun
                  className={`w-full h-full absolute inset-0 transition-all duration-500 ${
                    theme === 'dark' ? 'rotate-0 scale-100 opacity-100 text-[#D2F801]' : '-rotate-90 scale-0 opacity-0'
                  }`}
                />
                <HiOutlineMoon
                  className={`w-full h-full absolute inset-0 transition-all duration-500 ${
                    theme === 'light' ? 'rotate-0 scale-100 opacity-100 text-[#0F1115]' : 'rotate-90 scale-0 opacity-0'
                  }`}
                />
              </div>
            </button>

            {/* Prominent "Sign In" Pill Button */}
            <button
              onClick={() => setShowLoginModal(true)}
              className={`px-4 sm:px-5 py-2.5 font-bold text-xs sm:text-sm rounded-full shadow-md hover:scale-[1.03] transition-all flex items-center gap-1.5 cursor-pointer ${
                isLight
                  ? 'bg-[#0F1115] hover:bg-[#222631] text-white'
                  : 'bg-[#D2F801] hover:bg-[#DCFF26] text-[#0B0D11]'
              }`}
            >
              <HiOutlineIdentification className="w-4 h-4 hidden sm:inline" />
              <span>Sign In</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className={`lg:hidden p-2 rounded-xl border transition-colors ${
                isLight
                  ? 'bg-[#F4F5F7] border-neutral-200 text-[#0F1115]'
                  : 'bg-[#151820] border-[#272C37] text-white'
              }`}
              aria-label="Toggle navigation menu"
            >
              {mobileNavOpen ? <HiOutlineX className="w-5 h-5" /> : <HiOutlineMenuAlt3 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile/Tablet Navigation Drawer */}
        {mobileNavOpen && (
          <div
            className={`lg:hidden px-4 py-4 border-t animate-fade-in ${
              isLight ? 'bg-white border-neutral-200' : 'bg-[#0E1015] border-neutral-800'
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold">
              {[
                ['#services', 'Services'],
                ['#rules', 'Rules & Regulation'],
                ['#clients', 'Clients'],
                ['#pricing', 'Pricing Plans'],
                ['#reviews', 'Testimonials'],
                ['#faqs', 'FAQs'],
                ['#contact', 'Contact'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`px-3 py-2.5 rounded-xl border text-center transition-colors ${
                    isLight
                      ? 'bg-[#F6F7F9] border-neutral-200 text-[#0F1115] hover:bg-[#D2F801]'
                      : 'bg-[#151820] border-[#272C37] text-neutral-200 hover:border-[#D2F801] hover:text-[#D2F801]'
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ── 2. HERO SECTION (Screenshot Volt Lime Card on Light / Framed Obsidian+Volt on Dark) ── */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 lg:pt-8 lg:pb-12">
        <div
          className={`relative rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 lg:p-12 overflow-hidden transition-all ${
            isLight
              ? 'volt-hero-surface border border-[#C2EB00]'
              : 'bg-[#11141B] border border-[#252A36] shadow-2xl'
          }`}
        >
          {/* Decorative Screenshot Doodle Vector Sparkle + Arrow */}
          <svg
            className={`hidden lg:block absolute top-10 right-[45%] w-24 h-24 pointer-events-none ${
              isLight ? 'text-[#0B0D11]/70' : 'text-[#D2F801]/70'
            }`}
            viewBox="0 0 120 120"
            fill="none"
          >
            <path
              d="M15 20 C 55 25, 85 55, 50 92"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="3 4"
            />
            <path
              d="M42 84 L49 93 L59 87"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
            {/* Left Column: Headline & Value Proposition */}
            <div className="lg:col-span-6 space-y-5 sm:space-y-6">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold tracking-wide ${
                  isLight
                    ? 'bg-[#0F1115] text-[#D2F801]'
                    : 'bg-[#D2F801]/15 text-[#D2F801] border border-[#D2F801]/40'
                }`}
              >
                <HiOutlineSparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span>ENTERPRISE WORKFORCE &amp; STATUTORY PAYROLL</span>
              </div>

              <div className="space-y-3">
                <h1
                  className={`text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight leading-[1.12] ${
                    isLight ? 'text-[#0B0D11]' : 'text-white'
                  }`}
                >
                  SMART ATTENDANCE <br className="hidden sm:inline" />
                  <span
                    className={
                      isLight
                        ? 'text-[#0B0D11] underline decoration-[#0B0D11]/30 decoration-4 underline-offset-4'
                        : 'text-[#D2F801]'
                    }
                  >
                    &amp; PAYROLL SUITE
                  </span>
                </h1>
                <p
                  className={`text-sm sm:text-base lg:text-lg font-semibold leading-snug ${
                    isLight ? 'text-[#181B22]' : 'text-neutral-200'
                  }`}
                >
                  Automated biometric attendance, monthly PF &amp; Mediclaim deductions, and instant bank payout advice.
                </p>
                <p
                  className={`text-xs sm:text-sm font-medium leading-relaxed max-w-xl ${
                    isLight ? 'text-[#262B35]' : 'text-neutral-400'
                  }`}
                >
                  Scheduled auto-deductions every 2nd of the month with dual payroll generation (bulk &amp; manual) and one-click finance bank transfer schedules.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#pricing"
                  className={`px-6 py-3.5 font-bold rounded-full shadow-lg hover:scale-[1.03] transition-all text-xs sm:text-sm flex items-center gap-2 ${
                    isLight
                      ? 'bg-[#0B0D11] hover:bg-[#1E222B] text-white'
                      : 'bg-[#D2F801] hover:bg-[#DCFF26] text-[#0B0D11]'
                  }`}
                >
                  <span>⚡ View Subscription Plans</span>
                  <HiOutlineArrowRight className="w-4 h-4" />
                </a>

                <button
                  onClick={() => setShowLoginModal(true)}
                  className={`px-6 py-3.5 font-bold rounded-full border transition-all text-xs sm:text-sm flex items-center gap-2 cursor-pointer ${
                    isLight
                      ? 'bg-white/80 hover:bg-white text-[#0B0D11] border-[#0B0D11]/20'
                      : 'bg-[#191D26] hover:bg-[#232834] text-white border-[#2E3444]'
                  }`}
                >
                  <span>🚀 Sign In to Workspace</span>
                </button>
              </div>

              {/* Mini Trust Badges */}
              <div
                className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium pt-1 ${
                  isLight ? 'text-[#161920]' : 'text-neutral-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <HiOutlineCheckCircle className={`w-4 h-4 ${isLight ? 'text-[#0B0D11]' : 'text-[#D2F801]'}`} />
                  <span>Zero Setup Fees</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <HiOutlineCheckCircle className={`w-4 h-4 ${isLight ? 'text-[#0B0D11]' : 'text-[#D2F801]'}`} />
                  <span>Encrypted Razorpay Gateway</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <HiOutlineCheckCircle className={`w-4 h-4 ${isLight ? 'text-[#0B0D11]' : 'text-[#D2F801]'}`} />
                  <span>Tenant Isolation</span>
                </span>
              </div>
            </div>

            {/* Right Column: Dual Mockup + Real Analytics Photography Showcase (Screenshot Layout) */}
            <div className="lg:col-span-6">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* Light/Clean Corporate Analytics Photo Card */}
                <div className="sm:col-span-7 bg-white rounded-3xl p-4 sm:p-5 text-[#0F1115] shadow-2xl border border-black/10 transform sm:-rotate-1 hover:rotate-0 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Live HR Command
                      </span>
                      <h3 className="text-sm font-bold text-[#0F1115]">Workforce Analytics</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#D2F801] text-[#0B0D11] text-[10px] font-extrabold">
                      99.4% Sync
                    </span>
                  </div>
                  <div className="rounded-2xl overflow-hidden aspect-[16/10] bg-neutral-100 mb-3">
                    <img
                      src={analyticsDeskImg}
                      alt="Enterprise team monitoring HR and payroll analytics dashboard"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-left">
                    <div className="p-2.5 rounded-2xl bg-[#F6F7F9]">
                      <span className="text-[10px] text-neutral-500 font-medium block">Statutory PF</span>
                      <span className="text-sm font-extrabold text-[#0F1115]">12% Auto</span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-[#F6F7F9]">
                      <span className="text-[10px] text-neutral-500 font-medium block">Pay Cycle</span>
                      <span className="text-sm font-extrabold text-[#3F5C00]">2nd Monthly</span>
                    </div>
                  </div>
                </div>

                {/* Overlapping Obsidian Dark Card (matching screenshot's right phone card) */}
                <div className="sm:col-span-5 bg-[#0B0D11] rounded-3xl p-5 text-white shadow-2xl border border-white/10 transform sm:translate-y-4 sm:rotate-2 hover:rotate-0 transition-transform duration-300 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Payout Advice
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D2F801] animate-pulse" />
                  </div>

                  <div>
                    <div className="text-2xl font-extrabold text-[#D2F801] tracking-tight">
                      ₹{(pricingPlans.yearly?.price || 9999).toLocaleString()}
                    </div>
                    <p className="text-[11px] text-neutral-400">Annual Growth Plan Active</p>
                  </div>

                  {/* Clean vector telemetry sparkline */}
                  <div className="bg-[#161A22] rounded-2xl p-3 border border-white/5">
                    <svg viewBox="0 0 180 56" className="w-full h-12" fill="none">
                      <path
                        d="M4 44 L34 32 L58 38 L88 18 L116 26 L146 10 L176 14"
                        stroke="#D2F801"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="88" cy="18" r="3.5" fill="#D2F801" />
                      <circle cx="146" cy="10" r="4" fill="#FFFFFF" stroke="#D2F801" strokeWidth="2" />
                    </svg>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
                      <span>Face Verify</span>
                      <span className="text-[#D2F801] font-bold">100% Isolated</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="flex-1 text-center py-1.5 rounded-full bg-white/10 text-[10px] font-bold text-white">
                      QR Login
                    </span>
                    <span className="flex-1 text-center py-1.5 rounded-full bg-[#D2F801] text-[10px] font-extrabold text-[#0B0D11]">
                      IFSC PDF
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. LIVE COUNTER & METRICS SECTION (Screenshot Bento Style) ── */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Visitors */}
          <div className="bento-card p-6 sm:p-7 rounded-3xl relative overflow-hidden group transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`}>
                  Total System Visits
                </p>
                <h3 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
                  {stats.totalVisitors?.toLocaleString()}+
                </h3>
                <p className={`text-xs mt-1.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Live organic traffic tracked dynamically
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center text-2xl font-bold shadow-md flex-shrink-0 group-hover:scale-110 transition-transform">
                🌐
              </div>
            </div>
          </div>

          {/* Card 2: Subscribed Companies */}
          <div className="bento-card p-6 sm:p-7 rounded-3xl relative overflow-hidden group transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`}>
                  Subscribed Enterprises
                </p>
                <h3 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
                  {stats.totalSubscriptions}+
                </h3>
                <p className={`text-xs mt-1.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Active organizations &amp; businesses
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center text-2xl font-bold shadow-md flex-shrink-0 group-hover:scale-110 transition-transform">
                🏢
              </div>
            </div>
          </div>

          {/* Card 3: Client Reviews */}
          <div className="bento-card p-6 sm:p-7 rounded-3xl relative overflow-hidden group transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`}>
                  Verified Reviews
                </p>
                <h3 className="text-3xl sm:text-4xl font-extrabold mt-2 tracking-tight">
                  {stats.totalReviews}+
                </h3>
                <p className={`text-xs mt-1.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Average 4.95 / 5.0 customer satisfaction
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center text-2xl font-bold shadow-md flex-shrink-0 group-hover:scale-110 transition-transform">
                ⭐
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. OUR SERVICES SECTION ── */}
      <section id="services" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sticky Header Column (Screenshot "Advantages" layout!) */}
          <div className="lg:col-span-4 space-y-4">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isLight
                  ? 'bg-[#D2F801] text-[#0B0D11]'
                  : 'bg-[#D2F801]/15 text-[#D2F801] border border-[#D2F801]/40'
              }`}
            >
              Enterprise Solutions
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              Comprehensive HR, Attendance &amp; Payroll Engine
            </h2>
            <p className={`text-sm leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              From facial biometrics to automated PF calculations and direct finance bank disbursement, Employee Tracker powers modern corporate operations end-to-end.
            </p>

            {/* Real Corporate Collaboration Image Card */}
            <div className="rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 shadow-lg mt-4">
              <img
                src={officeDiscussionImg}
                alt="Corporate HR and leadership team reviewing payroll and attendance reports"
                className="w-full h-48 sm:h-52 object-cover"
              />
            </div>
          </div>

          {/* Right 2x3 Service Grid with Volt Lime Square Badges */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {servicesList.map((srv, idx) => (
              <div
                key={idx}
                className="bento-card p-6 rounded-3xl transition-all duration-300 group hover:-translate-y-1 hover:border-[#D2F801]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    {srv.icon}
                  </div>
                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                      isLight
                        ? 'bg-white text-[#0F1115] border-neutral-200'
                        : 'bg-[#0B0D11] text-[#D2F801] border-[#262B36]'
                    }`}
                  >
                    {srv.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-2">{srv.title}</h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  {srv.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DARK PULSE BANNER (Matching Screenshot Mid-Page Black Feature Card) ── */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="obsidian-banner-surface rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 lg:p-12 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D2F801] text-[#0B0D11] text-[11px] font-extrabold uppercase tracking-wider">
                Zero Cross-Tenant Leaks
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Enterprise Privacy, Statutory Accuracy &amp; Live Workforce Control
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
                Every company workspace operates inside its own strictly isolated database scope with automated attendance verification, statutory PF &amp; Mediclaim ledgers, and instant onboarding PDF badges.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <a
                  href="#rules"
                  className="btn-volt text-xs sm:text-sm inline-flex items-center gap-2"
                >
                  <span>Explore Rules &amp; Regulations</span>
                  <HiOutlineArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-3 shadow-2xl border border-white/20">
                <div className="rounded-2xl overflow-hidden aspect-[16/10]">
                  <img
                    src={teamCollabImg}
                    alt="Enterprise HR operations specialists collaborating on policy compliance"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="px-2 pt-3 pb-1 flex items-center justify-between text-[#0F1115]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Real-Time Compliance
                    </span>
                    <span className="text-xs font-extrabold">Verified Multi-Tenant Shield</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#D2F801] text-[#0B0D11] text-[10px] font-extrabold">
                    Active 24/7
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4B. NEW SECTION: RULES & REGULATION (Managed Dynamically by SuperAdmin) ── */}
      <section id="rules" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl space-y-2">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isLight
                  ? 'bg-[#D2F801] text-[#0B0D11]'
                  : 'bg-[#D2F801]/15 text-[#D2F801] border border-[#D2F801]/40'
              }`}
            >
              📜 Rules &amp; Regulation
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Workforce Policy, Salary, PF, Mediclaim &amp; Attendance Rules
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Transparent corporate governance policies covering monthly salary cycles, statutory Provident Fund, Mediclaim coverage, and biometric attendance discipline.
            </p>
          </div>

          {/* Responsive Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {ruleCategories.map((cat) => {
              const active = activeRuleCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveRuleCategory(cat)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? isLight
                        ? 'bg-[#0F1115] text-white shadow-md'
                        : 'bg-[#D2F801] text-[#0B0D11] shadow-md'
                      : isLight
                      ? 'bg-[#F4F5F7] text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
                      : 'bg-[#151820] text-neutral-300 hover:text-white border border-[#262B36]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {filteredRules.length === 0 ? (
          <div className="bento-card rounded-3xl p-10 text-center text-sm text-neutral-400">
            No rules configured for {activeRuleCategory} category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRules.map((rule, idx) => (
              <div
                key={rule._id || idx}
                className="bento-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-[#D2F801] group"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#D2F801] text-[#0B0D11] flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                        {getRuleIcon(rule.category)}
                      </div>
                      <span
                        className={`text-xs font-extrabold uppercase tracking-wider ${
                          isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'
                        }`}
                      >
                        {rule.category || 'General'} Rule
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        isLight
                          ? 'bg-white text-[#0F1115] border-neutral-200'
                          : 'bg-[#0B0D11] text-neutral-300 border-[#282E3B]'
                      }`}
                    >
                      {rule.badgeText || 'Policy'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold mb-2.5 leading-snug">
                    {rule.title}
                  </h3>
                  <p className={`text-xs sm:text-[13px] leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    {rule.summary}
                  </p>
                </div>

                <div
                  className={`mt-6 pt-4 border-t flex items-center justify-between text-[11px] font-semibold ${
                    isLight ? 'border-neutral-200 text-neutral-500' : 'border-[#252A36] text-neutral-500'
                  }`}
                >
                  <span>Clause #{String(idx + 1).padStart(2, '0')}</span>
                  <span className={isLight ? 'text-[#0F1115] font-bold' : 'text-[#D2F801] font-bold'}>
                    Active Policy ✓
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. OUR CLIENTS INFINITE LOOP MARQUEE SECTION ── */}
      <section
        id="clients"
        className={`relative z-10 w-full py-12 border-y overflow-hidden scroll-mt-20 ${
          isLight ? 'bg-[#F6F7F9] border-neutral-200' : 'bg-[#0E1016] border-[#1F242E]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
          <p className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`}>
            TRUSTED BY FORWARD-THINKING ENTERPRISES &amp; ORGANIZATIONS
          </p>
        </div>

        <div className="relative w-full overflow-hidden">
          <div className="animate-marquee flex items-center gap-6 sm:gap-8 whitespace-nowrap">
            {[
              ...(clients.length > 0
                ? clients
                : [
                    { name: 'TechFlow Global' },
                    { name: 'Nexus Enterprise' },
                    { name: 'Apex Solutions' },
                    { name: 'Vanguard Systems' },
                    { name: 'Starlight Financial' },
                    { name: 'Alpha Horizon' },
                  ]),
              ...(clients.length > 0
                ? clients
                : [
                    { name: 'TechFlow Global' },
                    { name: 'Nexus Enterprise' },
                    { name: 'Apex Solutions' },
                    { name: 'Vanguard Systems' },
                    { name: 'Starlight Financial' },
                    { name: 'Alpha Horizon' },
                  ]),
            ].map((client, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-5 py-3 rounded-full border transition-all shadow-sm ${
                  isLight
                    ? 'bg-white border-neutral-200 hover:border-[#0F1115]'
                    : 'bg-[#151821] border-[#262C38] hover:border-[#D2F801]'
                }`}
              >
                {client.logoUrl && !client.logoUrl.includes('photo-1618005182384') ? (
                  <img
                    src={client.logoUrl}
                    alt={client.name}
                    className="w-7 h-7 rounded-full object-cover bg-white"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#D2F801] text-[#0B0D11] flex items-center justify-center text-xs font-extrabold">
                    {client.name?.charAt(0)}
                  </div>
                )}
                <span className="font-bold text-xs sm:text-sm">{client.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING & SUBSCRIPTION PLANS (3 CARDS) ── */}
      <section id="pricing" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isLight
                ? 'bg-[#D2F801] text-[#0B0D11]'
                : 'bg-[#D2F801]/15 text-[#D2F801] border border-[#D2F801]/40'
            }`}
          >
            💎 Subscription Plans
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Transparent, Pay-As-You-Grow Pricing
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Instant online activation via Razorpay. Upgrade, renew, or switch plans anytime with zero data loss.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8 items-stretch">
          {/* Card 1: Monthly Plan */}
          <div className="bento-card rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:border-[#D2F801]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-extrabold uppercase tracking-wider ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`}>
                  {pricingPlans.monthly?.title || 'Monthly Flex'}
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                    isLight
                      ? 'bg-white text-neutral-600 border-neutral-200'
                      : 'bg-[#0B0D11] text-neutral-300 border-[#282E3B]'
                  }`}
                >
                  Standard
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold tracking-tight">
                    ₹{pricingPlans.monthly?.price?.toLocaleString()}
                  </span>
                  <span className={`text-xs font-medium ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>/ month</span>
                </div>
                {pricingPlans.monthly?.originalPrice && (
                  <p className="text-xs text-neutral-500 line-through mt-0.5">
                    ₹{pricingPlans.monthly?.originalPrice?.toLocaleString()} regular rate
                  </p>
                )}
              </div>

              <p className={`text-xs mb-6 leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                {pricingPlans.monthly?.description}
              </p>

              <div className={`space-y-3 border-t pt-5 mb-8 ${isLight ? 'border-neutral-200' : 'border-[#252A36]'}`}>
                {pricingPlans.monthly?.features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs">
                    <HiOutlineCheckCircle className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe('monthly')}
              className={`w-full py-3.5 font-bold rounded-full transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer ${
                isLight
                  ? 'bg-[#0F1115] hover:bg-[#232732] text-white'
                  : 'bg-[#1D212B] hover:bg-[#D2F801] text-white hover:text-[#0B0D11] border border-[#2F3646]'
              }`}
            >
              <span>Subscribe Monthly</span>
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Yearly Plan (Featured / Popular Obsidian + Volt Lime Contrast Card) */}
          <div className="bg-[#0B0D11] text-white rounded-3xl p-7 border-2 border-[#D2F801] flex flex-col justify-between hover:-translate-y-2 transition-all duration-300 shadow-2xl relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#D2F801] text-[#0B0D11] font-extrabold text-[11px] tracking-wider uppercase shadow-lg whitespace-nowrap">
              ⭐ Most Popular • Save 38%
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#D2F801]">
                  {pricingPlans.yearly?.title || 'Annual Growth'}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#D2F801]/15 text-[#D2F801] font-bold border border-[#D2F801]/40">
                  2 Months Free
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#D2F801] tracking-tight">
                    ₹{pricingPlans.yearly?.price?.toLocaleString()}
                  </span>
                  <span className="text-xs text-neutral-400 font-medium">/ year</span>
                </div>
                {pricingPlans.yearly?.originalPrice && (
                  <p className="text-xs text-neutral-500 line-through mt-0.5">
                    ₹{pricingPlans.yearly?.originalPrice?.toLocaleString()} regular rate
                  </p>
                )}
              </div>

              <p className="text-xs text-neutral-300 mb-6 leading-relaxed">
                {pricingPlans.yearly?.description}
              </p>

              <div className="space-y-3 border-t border-white/10 pt-5 mb-8">
                {pricingPlans.yearly?.features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-neutral-200">
                    <HiOutlineCheckCircle className="w-4 h-4 text-[#D2F801] flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe('yearly')}
              className="w-full py-3.5 bg-[#D2F801] hover:bg-[#DCFF26] text-[#0B0D11] font-extrabold rounded-full shadow-xl transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              <span>Subscribe Yearly &amp; Save</span>
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: 3-Year Enterprise Plan */}
          <div className="bento-card rounded-3xl p-7 border-2 border-amber-400/50 flex flex-col justify-between hover:border-amber-400 transition-all duration-300 hover:-translate-y-1.5 shadow-xl relative md:col-span-2 lg:col-span-1">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-400 text-[#0B0D11] font-extrabold text-[11px] tracking-wider uppercase shadow-lg whitespace-nowrap">
              👑 Maximum Savings • Over 45% Off
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className={`text-xs font-extrabold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  {pricingPlans.three_year?.title || '3-Year Enterprise'}
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                    isLight
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  Zero Rate Hikes
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-extrabold tracking-tight ${isLight ? 'text-[#0F1115]' : 'text-amber-300'}`}>
                    ₹{pricingPlans.three_year?.price?.toLocaleString()}
                  </span>
                  <span className={`text-xs font-medium ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>for 3 years</span>
                </div>
                {pricingPlans.three_year?.originalPrice && (
                  <p className="text-xs text-neutral-500 line-through mt-0.5">
                    ₹{pricingPlans.three_year?.originalPrice?.toLocaleString()} regular rate
                  </p>
                )}
              </div>

              <p className={`text-xs mb-6 leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                {pricingPlans.three_year?.description}
              </p>

              <div className={`space-y-3 border-t pt-5 mb-8 ${isLight ? 'border-neutral-200' : 'border-[#252A36]'}`}>
                {pricingPlans.three_year?.features?.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs">
                    <HiOutlineCheckCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenSubscribe('three_year')}
              className={`w-full py-3.5 font-extrabold rounded-full shadow-lg transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] ${
                isLight
                  ? 'bg-[#0F1115] hover:bg-[#232732] text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-[#0B0D11]'
              }`}
            >
              <span>Get 3-Year Enterprise</span>
              <HiOutlineArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. TESTIMONIALS & FEEDBACK SECTION ── */}
      <section id="reviews" className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
                isLight
                  ? 'bg-[#D2F801] text-[#0B0D11]'
                  : 'bg-[#D2F801]/15 text-[#D2F801] border border-[#D2F801]/40'
              }`}
            >
              Customer Voices
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Trusted by Hundreds of HR Leaders
            </h2>
            <p className={`text-xs sm:text-sm mt-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Read authentic feedback from enterprises running their daily attendance &amp; payroll on our system.
            </p>
          </div>

          <button
            onClick={() => setShowReviewModal(true)}
            className={`px-5 py-2.5 font-bold text-xs sm:text-sm rounded-full transition-all shadow-md flex items-center gap-2 cursor-pointer self-start sm:self-auto ${
              isLight
                ? 'bg-[#0F1115] text-white hover:bg-[#232732]'
                : 'bg-[#D2F801] text-[#0B0D11] hover:bg-[#DCFF26]'
            }`}
          >
            <span>✍️ Write a Review</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="bento-card p-6 rounded-3xl flex flex-col justify-between hover:border-[#D2F801] transition-all"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-400 mb-3">
                  {[...Array(t.rating || 5)].map((_, i) => (
                    <HiStar key={i} className="w-4 h-4" />
                  ))}
                </div>
                <p className={`text-xs sm:text-sm italic leading-relaxed mb-6 ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  "{t.comment}"
                </p>
              </div>

              <div className={`flex items-center gap-3 pt-4 border-t ${isLight ? 'border-neutral-200' : 'border-[#252A36]'}`}>
                <div className="w-10 h-10 rounded-full bg-[#D2F801] text-[#0B0D11] flex items-center justify-center font-extrabold text-sm">
                  {t.name?.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold">{t.name}</h4>
                  <p className={`text-[11px] font-medium ${isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}`}>
                    {t.role} • {t.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. QUERY & FAQ ACCORDION SECTION ── */}
      <section id="faqs" className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 scroll-mt-20">
        <div className="text-center mb-10 space-y-2">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isLight
                ? 'bg-[#D2F801] text-[#0B0D11]'
                : 'bg-[#D2F801]/15 text-[#D2F801] border border-[#D2F801]/40'
            }`}
          >
            Clear Answers
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className={`text-xs sm:text-sm ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Everything you need to know about attendance rules, auto-deductions, and subscription billing.
          </p>
        </div>

        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className={`bento-card rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen ? 'border-[#D2F801]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm transition-colors cursor-pointer"
                >
                  <span className="flex-1">{faq.question}</span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      isOpen
                        ? 'bg-[#D2F801] text-[#0B0D11]'
                        : isLight
                        ? 'bg-neutral-200 text-neutral-700'
                        : 'bg-[#222734] text-neutral-300'
                    }`}
                  >
                    <HiOutlineChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div
                    className={`px-5 pb-5 pt-2 text-xs sm:text-sm leading-relaxed border-t animate-fade-in ${
                      isLight ? 'text-neutral-600 border-neutral-200' : 'text-neutral-300 border-[#252A36]'
                    }`}
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 9. CONTACT US SECTION ── */}
      <section id="contact" className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 scroll-mt-20">
        <div className="bento-card rounded-[2rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold">
              Need Corporate Assistance? Contact Us
            </h2>
            <p className={`text-xs sm:text-sm ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Have questions regarding statutory compliance, bank integration, or enterprise customization? Fill in the form and our executive team will email you back promptly.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                  Your Full Name <span className={isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}>*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Sagnik Mondal"
                  required
                  className="input-field text-sm h-11"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                  Work Email Address <span className={isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}>*</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="input-field text-sm h-11"
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
                className="input-field text-sm h-11"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1.5">
                Message / Details <span className={isLight ? 'text-[#3F5C00]' : 'text-[#D2F801]'}>*</span>
              </label>
              <textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Describe your company requirements, employee size, or specific inquiries..."
                required
                rows={4}
                className="input-field text-sm p-3.5 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={contactSending}
              className={`w-full h-12 font-bold rounded-full shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer ${
                isLight
                  ? 'bg-[#0F1115] hover:bg-[#232732] text-white'
                  : 'bg-[#D2F801] hover:bg-[#DCFF26] text-[#0B0D11]'
              }`}
            >
              {contactSending ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
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

      {/* ── 10. ENTERPRISE OBSIDIAN FOOTER (Screenshot Bottom Style) ── */}
      <footer className="relative z-10 w-full bg-[#090A0D] text-white border-t border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-neutral-400">
          <div className="flex flex-col gap-1.5">
            <BrandLogo darkOnly compact />
            <span className="text-[10px] text-neutral-500 pl-1">
              © 2026 Employee Tracker Enterprise HRMS. All rights reserved.
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            <a href="#services" className="hover:text-[#D2F801] transition-colors">Services</a>
            <a href="#rules" className="hover:text-[#D2F801] transition-colors">Rules &amp; Regulation</a>
            <a href="#pricing" className="hover:text-[#D2F801] transition-colors">Subscription Pricing</a>
            <a href="#faqs" className="hover:text-[#D2F801] transition-colors">Compliance FAQ</a>
            <button onClick={() => setShowLoginModal(true)} className="text-[#D2F801] hover:underline font-bold cursor-pointer">
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

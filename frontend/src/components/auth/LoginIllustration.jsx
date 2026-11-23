import React from 'react';

const LoginIllustration = () => {
  return (
    <div className="relative w-full max-w-2xl mx-auto select-none pointer-events-none">
      {/* Ambient background glow behind the illustration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-4/5 bg-gradient-to-tr from-teal-500/20 via-amber-500/15 to-blue-600/20 rounded-full blur-3xl -z-10 animate-pulse-slow" />

      {/* Floating Stat Pill 1: Top Right */}
      <div className="absolute -top-3 right-4 z-20 pointer-events-auto animate-float hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl liquid-glass-teal text-xs font-bold text-teal-950 dark:text-teal-200 shadow-xl border border-teal-500/40 dark:border-teal-400/30">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-teal-950 dark:text-white font-black">99.4%</span> On-Time Attendance
      </div>

      {/* Floating Stat Pill 2: Left Middle */}
      <div className="absolute top-1/3 -left-4 z-20 pointer-events-auto animate-float-slow hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl liquid-glass-amber text-xs font-bold text-amber-950 dark:text-amber-200 shadow-xl border border-amber-500/40 dark:border-amber-400/30">
        <span className="text-base">🛡️</span>
        <span>PF &amp; Mediclaim Automated</span>
      </div>

      {/* Floating Stat Pill 3: Bottom Right */}
      <div className="absolute -bottom-3 right-8 z-20 pointer-events-auto animate-float hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl liquid-glass-teal text-xs font-bold text-teal-950 dark:text-teal-200 shadow-xl border border-teal-500/40 dark:border-teal-400/40">
        <span className="text-base">💳</span>
        <span>Bank Transfer Advice Ready</span>
      </div>

      {/* Main SVG Vector Graphic */}
      <svg
        viewBox="0 0 800 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-2xl"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="mainMonitorGrad" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="monitorScreenGrad" x1="0" y1="0" x2="0" y2="350" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>

          <linearGradient id="tealBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>

          <linearGradient id="amberBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <linearGradient id="coralBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <linearGradient id="blueBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>

          <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
          </linearGradient>

          {/* Shadows */}
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* ── BASE DESK LINE ── */}
        <path d="M40 450 H760" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="6 6" opacity="0.6" />

        {/* ── CENTRAL MAIN ANALYTICS SCREEN ── */}
        <g filter="url(#softShadow)">
          {/* Monitor Frame */}
          <rect x="140" y="70" width="520" height="340" rx="16" fill="url(#mainMonitorGrad)" stroke="#334155" strokeWidth="3" />
          {/* Header Bar */}
          <rect x="140" y="70" width="520" height="32" rx="16" fill="#0f172a" />
          <rect x="140" y="86" width="520" height="16" fill="#0f172a" />
          {/* Window control buttons */}
          <circle cx="165" cy="86" r="5" fill="#ef4444" />
          <circle cx="180" cy="86" r="5" fill="#f59e0b" />
          <circle cx="195" cy="86" r="5" fill="#10b981" />

          {/* Inner Screen Surface */}
          <rect x="156" y="112" width="488" height="282" rx="10" fill="url(#monitorScreenGrad)" stroke="#e2e8f0" strokeWidth="1" />

          {/* Screen Content - Left Panel: Metrics / Mini Briefcases */}
          <rect x="170" y="126" width="100" height="254" rx="8" fill="#f1f5f9" />
          {/* Mini analytics cards on left side */}
          <rect x="180" y="140" width="80" height="42" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          <rect x="188" y="150" width="30" height="5" rx="2.5" fill="#0e4b56" />
          <rect x="188" y="160" width="50" height="4" rx="2" fill="#94a3b8" />
          <circle cx="242" cy="161" r="9" fill="#ccfbf1" />
          <path d="M239 161 L241 163 L245 159" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          <rect x="180" y="194" width="80" height="42" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          <rect x="188" y="204" width="30" height="5" rx="2.5" fill="#ea580c" />
          <rect x="188" y="214" width="45" height="4" rx="2" fill="#94a3b8" />
          <circle cx="242" cy="215" r="9" fill="#ffedd5" />
          <rect x="238" y="211" width="8" height="8" rx="1.5" fill="#ea580c" />

          <rect x="180" y="248" width="80" height="42" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          <rect x="188" y="258" width="30" height="5" rx="2.5" fill="#2563eb" />
          <rect x="188" y="268" width="40" height="4" rx="2" fill="#94a3b8" />
          <circle cx="242" cy="269" r="9" fill="#dbeafe" />
          <circle cx="242" cy="269" r="4" fill="#2563eb" />

          {/* Mini Pie / Donut on bottom left */}
          <g transform="translate(220, 335)">
            <circle cx="0" cy="0" r="24" fill="#e2e8f0" />
            <path d="M0 0 L0 -24 A24 24 0 0 1 23 -7 Z" fill="#0e4b56" />
            <path d="M0 0 L23 -7 A24 24 0 0 1 12 21 Z" fill="#f59e0b" />
            <path d="M0 0 L12 21 A24 24 0 0 1 -20 13 Z" fill="#2563eb" />
            <path d="M0 0 L-20 13 A24 24 0 0 1 0 -24 Z" fill="#10b981" />
            <circle cx="0" cy="0" r="11" fill="#f1f5f9" />
          </g>

          {/* Screen Content - Right Main Area: Rich Bar & Line Charts */}
          {/* Main Top Header */}
          <rect x="286" y="128" width="130" height="8" rx="4" fill="#1e293b" />
          <rect x="286" y="142" width="200" height="5" rx="2.5" fill="#94a3b8" />

          {/* Chart Grid Lines */}
          <line x1="286" y1="230" x2="628" y2="230" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="286" y1="190" x2="628" y2="190" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />

          {/* Clustered Bar Chart 1 */}
          <rect x="300" y="200" width="14" height="60" rx="3" fill="url(#tealBarGrad)" />
          <rect x="318" y="175" width="14" height="85" rx="3" fill="url(#amberBarGrad)" />
          <rect x="336" y="188" width="14" height="72" rx="3" fill="url(#coralBarGrad)" />

          {/* Clustered Bar Chart 2 */}
          <rect x="370" y="180" width="14" height="80" rx="3" fill="url(#tealBarGrad)" />
          <rect x="388" y="160" width="14" height="100" rx="3" fill="url(#amberBarGrad)" />
          <rect x="406" y="170" width="14" height="90" rx="3" fill="url(#blueBarGrad)" />

          {/* Clustered Bar Chart 3 */}
          <rect x="440" y="195" width="14" height="65" rx="3" fill="url(#coralBarGrad)" />
          <rect x="458" y="168" width="14" height="92" rx="3" fill="url(#tealBarGrad)" />
          <rect x="476" y="155" width="14" height="105" rx="3" fill="url(#amberBarGrad)" />

          {/* Donut Chart in Main Screen Top Right */}
          <g transform="translate(565, 185)">
            <circle cx="0" cy="0" r="34" fill="#e2e8f0" />
            <path d="M0 0 L0 -34 A34 34 0 0 1 32 11 Z" fill="#0e4b56" />
            <path d="M0 0 L32 11 A34 34 0 0 1 -11 32 Z" fill="#f59e0b" />
            <path d="M0 0 L-11 32 A34 34 0 0 1 -34 0 Z" fill="#2563eb" />
            <path d="M0 0 L-34 0 A34 34 0 0 1 0 -34 Z" fill="#ea580c" />
            <circle cx="0" cy="0" r="17" fill="#ffffff" />
          </g>

          {/* Trend Line Chart across bottom */}
          <path
            d="M290 350 L340 330 L390 342 L440 310 L490 325 L540 295 L590 305 L625 280"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Trend Line Data Dots */}
          <circle cx="340" cy="330" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          <circle cx="440" cy="310" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          <circle cx="540" cy="295" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
          <circle cx="625" cy="280" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
        </g>

        {/* ── FLOATING EXECUTIVE 3D CUBES & COINS ── */}
        {/* Top Floating Isometric Orange Cube */}
        <g transform="translate(380, 42)">
          <path d="M0 10 L15 2 L30 10 L15 18 Z" fill="#f59e0b" />
          <path d="M0 10 L15 18 L15 36 L0 28 Z" fill="#d97706" />
          <path d="M30 10 L15 18 L15 36 L30 28 Z" fill="#b45309" />
        </g>

        {/* Small Orange Cube Left */}
        <g transform="translate(110, 150)">
          <path d="M0 7 L10 1 L20 7 L10 13 Z" fill="#ea580c" />
          <path d="M0 7 L10 13 L10 25 L0 19 Z" fill="#c2410c" />
          <path d="M20 7 L10 13 L10 25 L20 19 Z" fill="#9a3412" />
        </g>

        {/* Floating Golden Coin */}
        <g transform="translate(125, 220)">
          <circle cx="16" cy="16" r="16" fill="#f59e0b" />
          <circle cx="16" cy="16" r="13" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
          <text x="16" y="21" fontSize="14" fontWeight="bold" fill="#78350f" textAnchor="middle" fontFamily="sans-serif">$</text>
        </g>

        {/* ── FOREGROUND LAPTOP WITH SPREADSHEET ── */}
        <g transform="translate(245, 340)" filter="url(#softShadow)">
          {/* Laptop Screen */}
          <rect x="0" y="0" width="135" height="90" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <rect x="6" y="6" width="123" height="78" rx="4" fill="#ffffff" />
          {/* Window dots */}
          <circle cx="14" cy="12" r="2.5" fill="#ef4444" />
          <circle cx="21" cy="12" r="2.5" fill="#f59e0b" />
          <circle cx="28" cy="12" r="2.5" fill="#10b981" />
          {/* Spreadsheet Grid */}
          <rect x="12" y="20" width="111" height="8" fill="#0e4b56" rx="1.5" />
          <line x1="12" y1="36" x2="123" y2="36" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="12" y1="44" x2="123" y2="44" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="12" y1="52" x2="123" y2="52" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="12" y1="60" x2="123" y2="60" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="12" y1="68" x2="123" y2="68" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="12" y1="76" x2="123" y2="76" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="38" y1="20" x2="38" y2="80" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="68" y1="20" x2="68" y2="80" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="96" y1="20" x2="96" y2="80" stroke="#cbd5e1" strokeWidth="1" />
          {/* Highlight cells */}
          <rect x="40" y="38" width="26" height="5" fill="#fef08a" rx="1" />
          <rect x="70" y="54" width="24" height="5" fill="#bbf7d0" rx="1" />
          {/* Laptop Base */}
          <path d="M-15 90 L150 90 L135 98 L0 98 Z" fill="#94a3b8" />
        </g>

        {/* ── FOREGROUND ACCESSORIES: COFFEE MUG & FOLDERS ── */}
        {/* Coffee Mug with Steam */}
        <g transform="translate(395, 395)">
          <rect x="0" y="10" width="24" height="30" rx="4" fill="#ea580c" />
          {/* Handle */}
          <path d="M24 16 C30 16 30 32 24 32" stroke="#ea580c" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Steam lines */}
          <path d="M6 5 Q10 0 6 -5" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
          <path d="M14 7 Q18 2 14 -3" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>

        {/* Office Folders Stack */}
        <g transform="translate(100, 390)">
          <rect x="0" y="0" width="75" height="15" rx="3" fill="#ffffff" stroke="#334155" strokeWidth="2" />
          <circle cx="12" cy="7.5" r="3" fill="#0e4b56" />
          <line x1="22" y1="7.5" x2="65" y2="7.5" stroke="#94a3b8" strokeWidth="2" />

          <rect x="0" y="17" width="75" height="15" rx="3" fill="#ffffff" stroke="#334155" strokeWidth="2" />
          <circle cx="12" cy="24.5" r="3" fill="#ea580c" />
          <line x1="22" y1="24.5" x2="65" y2="24.5" stroke="#94a3b8" strokeWidth="2" />

          <rect x="0" y="34" width="75" height="15" rx="3" fill="#ffffff" stroke="#334155" strokeWidth="2" />
          <circle cx="12" cy="41.5" r="3" fill="#2563eb" />
          <line x1="22" y1="41.5" x2="65" y2="41.5" stroke="#94a3b8" strokeWidth="2" />
        </g>

        {/* Pen Holder Cup */}
        <g transform="translate(540, 412)">
          <rect x="0" y="10" width="22" height="26" rx="3" fill="#0284c7" />
          <line x1="5" y1="10" x2="2" y2="-4" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="11" y1="10" x2="11" y2="-6" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="17" y1="10" x2="20" y2="-3" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* ── CHARACTER 1: FEMALE FINANCIAL ANALYST (LEFT OF SCREEN) ── */}
        <g transform="translate(480, 240)">
          {/* Hair back */}
          <path d="M22 10 Q10 25 15 50 Q30 55 45 45 Q50 25 38 10 Z" fill="#0f172a" />
          {/* Head & Neck */}
          <circle cx="30" cy="25" r="14" fill="#fed7aa" />
          {/* Hair front */}
          <path d="M18 20 Q30 8 42 16 Q35 12 25 15 Z" fill="#0f172a" />
          {/* Neck */}
          <rect x="27" y="38" width="6" height="8" fill="#fdba74" />
          {/* Blazer (Mustard/Amber) */}
          <path d="M12 46 Q30 42 48 46 L54 110 L6 110 Z" fill="#f59e0b" />
          {/* Collar / Blouse */}
          <path d="M24 46 L30 62 L36 46 Z" fill="#ffffff" />
          {/* Skirt / Pants */}
          <path d="M8 110 L52 110 L48 190 L12 190 Z" fill="#0f172a" />
          {/* Arm holding tablet */}
          <path d="M14 55 Q2 80 18 95" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
          {/* Digital Tablet */}
          <rect x="18" y="80" width="36" height="26" rx="4" fill="#1e293b" transform="rotate(-12, 18, 80)" />
          <rect x="21" y="83" width="30" height="20" rx="2" fill="#38bdf8" transform="rotate(-12, 18, 80)" />
          {/* Hands */}
          <circle cx="20" cy="98" r="4.5" fill="#fed7aa" />
          <circle cx="48" cy="92" r="4.5" fill="#fed7aa" />
        </g>

        {/* ── CHARACTER 2: MALE CORPORATE STRATEGIST (ROYAL BLUE SUIT) ── */}
        <g transform="translate(565, 215)">
          {/* Head & Face */}
          <circle cx="40" cy="25" r="15" fill="#fed7aa" />
          {/* Hair */}
          <path d="M26 22 Q32 8 54 15 Q55 24 53 28 Q45 14 30 18 Z" fill="#1e293b" />
          {/* Neck */}
          <rect x="36" y="38" width="8" height="8" fill="#fdba74" />
          {/* Deep Teal Corporate Suit Jacket */}
          <path d="M18 46 Q40 42 62 46 L68 135 L12 135 Z" fill="#0e4b56" />
          {/* White Dress Shirt & Tie */}
          <path d="M34 46 L40 70 L46 46 Z" fill="#ffffff" />
          <polygon points="38,52 42,52 41,75 39,75" fill="#ea580c" />
          {/* Suit Trousers */}
          <path d="M14 135 L66 135 L62 215 L42 215 L40 150 L38 215 L18 215 Z" fill="#08252b" />
          {/* Arm & Hand holding financial document */}
          <path d="M20 55 Q10 85 24 100" stroke="#0e4b56" strokeWidth="8" strokeLinecap="round" />
          <path d="M60 55 Q72 85 54 105" stroke="#0e4b56" strokeWidth="8" strokeLinecap="round" />
          <circle cx="26" cy="102" r="5" fill="#fed7aa" />
          <circle cx="52" cy="106" r="5" fill="#fed7aa" />
          {/* Financial Document Sheet */}
          <rect x="22" y="92" width="35" height="48" rx="2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" transform="rotate(4, 22, 92)" />
          <line x1="28" y1="102" x2="48" y2="102" stroke="#0d9488" strokeWidth="2" />
          <line x1="28" y1="110" x2="52" y2="110" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="28" y1="117" x2="50" y2="117" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="28" y1="124" x2="44" y2="124" stroke="#94a3b8" strokeWidth="1.5" />
        </g>

        {/* ── SECONDARY REPORT STAND (FAR RIGHT) ── */}
        <g transform="translate(680, 110)">
          {/* Board Frame */}
          <rect x="0" y="0" width="75" height="90" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          {/* Header */}
          <rect x="8" y="10" width="35" height="5" rx="2.5" fill="#0e4b56" />
          {/* Line Chart */}
          <path d="M10 55 L25 40 L40 48 L65 22" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="65" cy="22" r="3.5" fill="#ea580c" />
          {/* Mini Bar Chart */}
          <rect x="12" y="65" width="6" height="15" rx="1.5" fill="#0e4b56" />
          <rect x="22" y="60" width="6" height="20" rx="1.5" fill="#f59e0b" />
          <rect x="32" y="68" width="6" height="12" rx="1.5" fill="#2563eb" />
          <rect x="42" y="55" width="6" height="25" rx="1.5" fill="#10b981" />
          <rect x="52" y="62" width="6" height="18" rx="1.5" fill="#ea580c" />
          {/* Stand Legs */}
          <line x1="37" y1="90" x2="37" y2="150" stroke="#94a3b8" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
};

export default LoginIllustration;

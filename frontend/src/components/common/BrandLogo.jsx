const BrandLogo = ({ compact = false, subtitle = 'Enterprise Attendance & Payroll', darkOnly = false }) => {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 select-none">
      {/* Circle Lightning Emblem matching Screenshots 2 & 3 */}
      <div
        className={`${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        } rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-md ${
          darkOnly
            ? 'bg-[#D2F801] text-[#0B0D11] border border-[#D2F801]'
            : 'bg-[#0F1115] dark:bg-[#D2F801] text-[#D2F801] dark:text-[#0B0D11] border border-[#8EC000]/50 dark:border-[#D2F801] dark:shadow-[0_0_16px_rgba(210,248,1,0.3)]'
        }`}
      >
        <span className={`${compact ? 'text-base' : 'text-lg'} leading-none`}>⚡</span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-nowrap">
          <span
            className={`font-display font-extrabold tracking-tight truncate ${
              compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
            } ${darkOnly ? 'text-white' : 'text-[#0F1115] dark:text-white'}`}
          >
            Employee Tracker
          </span>
          <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#D2F801] text-[#0B0D11] flex-shrink-0">
            PRO
          </span>
        </div>
        <span
          className={`font-semibold block -mt-0.5 tracking-wider uppercase truncate ${
            compact ? 'text-[9px]' : 'text-[9.5px] sm:text-[10px]'
          } ${darkOnly ? 'text-[#D2F801]' : 'text-neutral-500 dark:text-[#D2F801]'}`}
        >
          {subtitle}
        </span>
      </div>
    </div>
  );
};

export default BrandLogo;

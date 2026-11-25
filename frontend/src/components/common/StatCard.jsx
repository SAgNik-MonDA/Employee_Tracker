const StatCard = ({ icon, label, value, color = 'primary', trend }) => {
  const iconBgMap = {
    primary: 'bg-[#D2F801] text-[#0B0D11]',
    emerald: 'bg-[#D2F801] text-[#0B0D11]',
    amber: 'bg-amber-400 text-[#0B0D11]',
    rose: 'bg-rose-500/15 text-rose-500',
    violet: 'bg-[#D2F801] text-[#0B0D11]',
    cyan: 'bg-[#D2F801] text-[#0B0D11]',
    teal: 'bg-[#D2F801] text-[#0B0D11]',
  };

  return (
    <div className="glass-card-hover p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl shadow-sm ${iconBgMap[color] || iconBgMap.primary}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {trend && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              trend > 0
                ? 'bg-[#D2F801]/20 text-[#3F5C00] dark:text-[#D2F801]'
                : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <h3 className="text-2xl lg:text-3xl font-bold font-display text-surface-100 mb-1 truncate" title={value}>
        {value}
      </h3>
      <p className="text-sm text-surface-400 font-medium">{label}</p>
    </div>
  );
};

export default StatCard;

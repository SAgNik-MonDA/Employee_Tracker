const StatCard = ({ icon, label, value, color = 'primary', trend }) => {
  const colorMap = {
    primary: 'from-primary-600/20 to-primary-500/10 border-primary-500/30 text-primary-400',
    emerald: 'from-emerald-600/20 to-emerald-500/10 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-600/20 to-amber-500/10 border-amber-500/30 text-amber-400',
    rose: 'from-rose-600/20 to-rose-500/10 border-rose-500/30 text-rose-400',
    violet: 'from-violet-600/20 to-violet-500/10 border-violet-500/30 text-violet-400',
    cyan: 'from-cyan-600/20 to-cyan-500/10 border-cyan-500/30 text-cyan-400',
  };

  const iconBgMap = {
    primary: 'bg-primary-500/20 text-primary-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    rose: 'bg-rose-500/20 text-rose-400',
    violet: 'bg-violet-500/20 text-violet-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  };

  return (
    <div className={`glass-card-hover p-6 bg-gradient-to-br ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBgMap[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
            trend > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <h3 className="text-3xl font-bold font-display text-surface-100 mb-1">{value}</h3>
      <p className="text-sm text-surface-400 font-medium">{label}</p>
    </div>
  );
};

export default StatCard;

const StatCard = ({ icon, label, value, color = 'primary', trend }) => {
  const colorMap = {
    primary: 'from-emerald-600/15 to-teal-500/10 border-teal-500/50 text-teal-300',
    emerald: 'from-emerald-600/15 to-emerald-500/10 border-teal-500/50 text-emerald-300',
    amber: 'from-amber-600/15 to-amber-500/10 border-amber-500/50 text-amber-300',
    rose: 'from-rose-600/15 to-rose-500/10 border-rose-500/50 text-rose-300',
    violet: 'from-teal-600/15 to-emerald-500/10 border-teal-500/50 text-teal-300',
    cyan: 'from-teal-600/15 to-cyan-500/10 border-teal-500/50 text-teal-300',
    teal: 'from-teal-600/15 to-emerald-500/10 border-teal-500/50 text-teal-300',
  };

  const iconBgMap = {
    primary: 'bg-teal-500/20 text-teal-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-500/20 text-amber-300',
    rose: 'bg-rose-500/20 text-rose-300',
    violet: 'bg-teal-500/20 text-teal-300',
    cyan: 'bg-teal-500/20 text-teal-300',
    teal: 'bg-teal-500/20 text-teal-300',
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
      <h3 className="text-2xl lg:text-3xl font-bold font-display text-surface-100 mb-1 truncate" title={value}>{value}</h3>
      <p className="text-sm text-surface-400 font-medium">{label}</p>
    </div>
  );
};

export default StatCard;

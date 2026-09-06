import { useAuth } from '../../context/AuthContext';

const BirthdayBanner = () => {
  const { user } = useAuth();

  if (!user || !user.dateOfBirth) return null;

  const today = new Date();
  const dob   = new Date(user.dateOfBirth);

  const isBirthday =
    today.getDate() === dob.getDate() &&
    today.getMonth() === dob.getMonth();

  if (!isBirthday) return null;

  const firstName = user.name ? user.name.split(' ')[0] : 'Employee';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 p-6 sm:p-8 text-white shadow-2xl border border-pink-400/30 animate-fade-in mb-6">
      {/* Decorative Blur Orbs */}
      <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
        {/* Animated Cake Icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl shadow-inner shrink-0 transform hover:scale-110 transition-transform duration-300">
          🎂
        </div>

        <div className="flex-1 space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold tracking-wide uppercase text-pink-100 border border-white/20">
            🎉 Special Day Today!
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
            Happy Birthday, {firstName}! 🎈
          </h2>
          <p className="text-sm text-pink-100/90 leading-relaxed">
            Wishing you a day filled with laughter, happiness, and great accomplishments! On behalf of the entire company, thank you for being such an awesome part of our team! 🥳✨
          </p>
        </div>
      </div>

      {/* Floating Wishes Bar */}
      <div className="mt-4 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-pink-200 font-medium">
        <span className="flex items-center gap-1">
          🎁 Have a fantastic celebration!
        </span>
        <span className="hidden sm:inline-block tracking-widest opacity-85">
          🎈 🌟 🎂 🎁 🎉
        </span>
      </div>
    </div>
  );
};

export default BirthdayBanner;

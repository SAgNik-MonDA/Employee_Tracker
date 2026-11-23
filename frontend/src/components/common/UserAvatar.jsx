import { useState } from 'react';

/**
 * UserAvatar — shows profile picture if available, else displays a stylish
 * corporate vector avatar in the brand teal/emerald theme.
 * Props:
 *   user        — user object { name, profilePicture }
 *   size        — "xs" | "sm" | "md" | "lg" | "xl"  (default: "md")
 *   className   — extra tailwind classes
 *   onClick     — optional click handler
 */
const AVATAR_BASE_URL = import.meta.env.DEV 
  ? "http://localhost:5000/uploads/avatars/" 
  : "https://employee-tracker-backend-6t0z.onrender.com/uploads/avatars/";

const sizeMap = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-xl",
  xl: "w-24 h-24 text-3xl",
};

const UserAvatar = ({ user, size = "md", className = "", onClick }) => {
  const [imgError, setImgError] = useState(false);
  const sizeClass = sizeMap[size] || sizeMap.md;
  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";
  const hasPhoto = Boolean(user?.profilePicture && user.profilePicture !== "");
  const photoUrl = hasPhoto
    ? (user.profilePicture.startsWith('http://') || user.profilePicture.startsWith('https://')
        ? user.profilePicture
        : `${AVATAR_BASE_URL}${user.profilePicture}`)
    : null;

  return (
    <div
      onClick={onClick}
      className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 relative
                  ${onClick ? "cursor-pointer" : ""}
                  ${className}`}
      title={user?.name || "User"}
    >
      {hasPhoto && photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={user?.name || "Avatar"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        /* Modern corporate default avatar vector with emerald/teal gradient */
        <div className="w-full h-full bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 flex items-center justify-center relative border border-teal-400/40 shadow-inner">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-[72%] h-[72%] text-teal-100 drop-shadow"
          >
            <circle cx="12" cy="7.5" r="4" fill="currentColor" fillOpacity="0.95" />
            <path
              d="M4 19.5C4 15.91 7.58 13 12 13C16.42 13 20 15.91 20 19.5V20.5H4V19.5Z"
              fill="currentColor"
              fillOpacity="0.9"
            />
          </svg>
          {(size === 'xl' || size === 'lg') && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-surface-900/90 text-teal-300 font-bold text-[10px] border border-teal-400/50 shadow">
              {initial}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;


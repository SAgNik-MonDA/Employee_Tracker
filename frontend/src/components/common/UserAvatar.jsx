/**
 * UserAvatar — shows profile picture if available, else shows initials circle.
 * Props:
 *   user        — user object { name, profilePicture }
 *   size        — "sm" | "md" | "lg" | "xl"  (default: "md")
 *   className   — extra tailwind classes
 *   onClick     — optional click handler
 */
const AVATAR_BASE_URL = "http://localhost:5000/uploads/avatars/";

const sizeMap = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-xl",
  xl: "w-24 h-24 text-3xl",
};

const UserAvatar = ({ user, size = "md", className = "", onClick }) => {
  const sizeClass = sizeMap[size] || sizeMap.md;
  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";
  const hasPhoto = user?.profilePicture && user.profilePicture !== "";

  return (
    <div
      onClick={onClick}
      className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0
                  ${onClick ? "cursor-pointer" : ""}
                  ${className}`}
    >
      {hasPhoto ? (
        <img
          src={`${AVATAR_BASE_URL}${user.profilePicture}`}
          alt={user?.name || "Avatar"}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials if image fails to load
            e.target.style.display = "none";
            e.target.parentElement.classList.add(
              "bg-gradient-to-br", "from-primary-500", "to-violet-500",
              "flex", "items-center", "justify-center"
            );
            e.target.parentElement.innerHTML = `<span class="text-white font-bold">${initial}</span>`;
          }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center">
          <span className="text-white font-bold">{initial}</span>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;


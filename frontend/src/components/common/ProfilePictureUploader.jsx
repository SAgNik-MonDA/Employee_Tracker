import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineCamera, HiOutlineTrash, HiOutlineUpload, HiOutlineX, HiOutlinePhotograph } from "react-icons/hi";
import API from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "./UserAvatar";
import toast from "react-hot-toast";

const ProfilePictureUploader = () => {
  const { user, updateProfilePicture } = useAuth();
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG, GIF or WebP images allowed");
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setShowModal(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", selectedFile);

      const { data } = await API.post("/auth/upload-avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      updateProfilePicture(data.profilePicture);
      toast.success("Profile picture updated successfully!");
      setShowModal(false);
      setSelectedFile(null);
      setPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.profilePicture) return;
    try {
      await API.delete("/auth/delete-avatar");
      updateProfilePicture("");
      toast.success("Profile picture removed");
    } catch (err) {
      toast.error("Failed to remove picture");
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // Modal rendered via Portal to escape parent stacking contexts
  const modal = showModal
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "380px",
              maxHeight: "85vh",
              borderRadius: "20px",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              backgroundColor: "#0f172a",
              boxShadow:
                "0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.08)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "ppuModalIn 0.3s ease-out",
            }}
          >
            {/* ---- Header ---- */}
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(71, 85, 105, 0.4)",
                background: "linear-gradient(180deg, rgba(30,41,59,0.8) 0%, transparent 100%)",
                flexShrink: 0,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#f1f5f9",
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  Update Profile Picture
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#94a3b8",
                    margin: "4px 0 0 0",
                  }}
                >
                  Preview your new photo before saving
                </p>
              </div>
              <button
                onClick={handleCancel}
                style={{
                  padding: "6px",
                  borderRadius: "8px",
                  color: "#94a3b8",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Close"
              >
                <HiOutlineX style={{ width: "20px", height: "20px" }} />
              </button>
            </div>

            {/* ---- Body (scrollable) ---- */}
            <div
              style={{
                padding: "28px 24px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "18px",
                overflowY: "auto",
                flex: "1 1 auto",
                minHeight: 0,
              }}
            >
              {/* Preview circle */}
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "3px solid rgba(99, 102, 241, 0.35)",
                  boxShadow: "0 0 25px rgba(99, 102, 241, 0.15)",
                  flexShrink: 0,
                }}
              >
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              {/* File info */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "#94a3b8",
                }}
              >
                <HiOutlinePhotograph
                  style={{
                    width: "16px",
                    height: "16px",
                    color: "#818cf8",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: "#e2e8f0",
                    fontWeight: 500,
                    maxWidth: "170px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedFile?.name}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  ({formatFileSize(selectedFile?.size || 0)})
                </span>
              </div>
            </div>

            {/* ---- Footer with buttons (always visible) ---- */}
            <div
              style={{
                padding: "16px 24px 20px",
                display: "flex",
                gap: "12px",
                borderTop: "1px solid rgba(71, 85, 105, 0.4)",
                flexShrink: 0,
                background: "linear-gradient(0deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.95) 100%)",
              }}
            >
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "11px 16px",
                  borderRadius: "12px",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#ffffff",
                  border: "none",
                  cursor: uploading ? "not-allowed" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                }}
              >
                {uploading ? (
                  <>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "ppuSpin 0.7s linear infinite",
                      }}
                    />
                    Uploading...
                  </>
                ) : (
                  <>
                    <HiOutlineUpload style={{ width: "16px", height: "16px" }} />
                    Save Photo
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: "12px",
                  fontWeight: 500,
                  fontSize: "14px",
                  color: "#cbd5e1",
                  backgroundColor: "rgba(51, 65, 85, 0.5)",
                  border: "1px solid rgba(71, 85, 105, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </div>

          <style>{`
            @keyframes ppuModalIn {
              from { opacity: 0; transform: translateY(24px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes ppuSpin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {/* Avatar with camera overlay */}
      <div className="relative group w-fit">
        <UserAvatar user={user} size="xl" />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-surface-950/50 opacity-0 group-hover:opacity-100
                     transition-opacity duration-200 flex flex-col items-center justify-center gap-1"
          title="Change profile picture"
        >
          <HiOutlineCamera className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">Change</span>
        </button>

        {user?.profilePicture && (
          <button
            onClick={handleDelete}
            title="Remove photo"
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600
                       flex items-center justify-center transition-colors shadow-lg"
          >
            <HiOutlineTrash className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {modal}
    </>
  );
};

export default ProfilePictureUploader;

import { useRef, useState } from "react";
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

  return (
    <>
      {/* Avatar with camera overlay */}
      <div className="relative group w-fit">
        <UserAvatar user={user} size="xl" />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100
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

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.95)",
              borderColor: "rgba(71, 85, 105, 0.5)",
              animation: "modalSlideUp 0.3s ease-out",
            }}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(71, 85, 105, 0.5)" }}
            >
              <div>
                <h3 className="text-lg font-bold text-white">Update Profile Picture</h3>
                <p className="text-sm text-slate-400 mt-0.5">Preview your new photo before saving</p>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Close"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center gap-5">
              <div
                className="w-36 h-36 rounded-full overflow-hidden shadow-2xl"
                style={{
                  border: "4px solid rgba(99, 102, 241, 0.3)",
                  boxShadow: "0 0 30px rgba(99, 102, 241, 0.15)",
                }}
              >
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-400 text-center">
                <HiOutlinePhotograph className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                <span className="text-slate-200 font-medium truncate max-w-[200px]">
                  {selectedFile?.name}
                </span>
                <span className="text-xs text-slate-500">
                  ({formatFileSize(selectedFile?.size || 0)})
                </span>
              </div>

              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                             font-semibold text-white transition-all duration-300
                             disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  style={{
                    background: uploading
                      ? "linear-gradient(to right, #4338ca, #4f46e5)"
                      : "linear-gradient(to right, #4f46e5, #6366f1)",
                    boxShadow: "0 4px 15px rgba(79, 70, 229, 0.35)",
                  }}
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <HiOutlineUpload className="w-4 h-4" />
                      Save Photo
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-5 py-2.5 rounded-xl font-medium text-slate-200
                             transition-all duration-300 active:scale-[0.98]"
                  style={{
                    backgroundColor: "rgba(51, 65, 85, 0.5)",
                    border: "1px solid rgba(71, 85, 105, 0.5)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
};

export default ProfilePictureUploader;
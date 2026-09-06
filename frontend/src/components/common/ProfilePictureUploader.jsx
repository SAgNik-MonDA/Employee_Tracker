import { useRef, useState } from "react";
import { HiOutlineCamera, HiOutlineTrash, HiOutlineUpload } from "react-icons/hi";
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

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }
    // Validate type
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
      toast.success("Profile picture updated! ??");
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

  return (
    <>
      {/* Avatar with camera overlay */}
      <div className="relative group w-fit">
        <UserAvatar user={user} size="xl" />

        {/* Camera overlay on hover */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100
                     transition-opacity duration-200 flex flex-col items-center justify-center gap-1"
          title="Change profile picture"
        >
          <HiOutlineCamera className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">Change</span>
        </button>

        {/* Delete button — only if has picture */}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Preview Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm animate-slide-up">
            <div className="p-6 border-b border-surface-700/50">
              <h3 className="text-lg font-display font-bold text-surface-100">Update Profile Picture</h3>
              <p className="text-sm text-surface-500 mt-1">Preview your new photo before saving</p>
            </div>

            <div className="p-6 flex flex-col items-center gap-6">
              {/* Preview */}
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-primary-500/30 shadow-2xl shadow-primary-500/20">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <p className="text-sm text-surface-400 text-center">
                ?? <span className="text-surface-200 font-medium">{selectedFile?.name}</span>
                <br />
                <span className="text-xs text-surface-500">
                  {(selectedFile?.size / 1024).toFixed(1)} KB
                </span>
              </p>

              {/* Action buttons */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
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
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePictureUploader;

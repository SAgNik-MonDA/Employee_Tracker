import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  HiOutlineExclamation,
  HiOutlineX,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineTrash,
} from 'react-icons/hi';

/**
 * AdminSelfDeleteModal
 * Enforces production security rule:
 * NOBODY can delete an Admin account except the Admin themselves.
 * When the Admin chooses to delete their own account, this modal
 * performs password authentication, impact analysis (sole admin vs surviving admins),
 * and typing "DELETE MY ACCOUNT" confirmation before permanent deletion.
 */
const AdminSelfDeleteModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [selfDeleteStatus, setSelfDeleteStatus] = useState(null);
  const [loadingDeleteStatus, setLoadingDeleteStatus] = useState(false);
  const [selfDeletePassword, setSelfDeletePassword] = useState('');
  const [selfDeleteConfirmText, setSelfDeleteConfirmText] = useState('');
  const [showSelfDeletePw, setShowSelfDeletePw] = useState(false);
  const [selfDeleting, setSelfDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelfDeletePassword('');
      setSelfDeleteConfirmText('');
      setShowSelfDeletePw(false);
      setSelfDeleteStatus(null);
      return;
    }

    let isMounted = true;
    setLoadingDeleteStatus(true);
    API.get('/auth/self-delete-status')
      .then(({ data }) => {
        if (isMounted) setSelfDeleteStatus(data);
      })
      .catch(() => {
        if (isMounted) setSelfDeleteStatus(null);
      })
      .finally(() => {
        if (isMounted) setLoadingDeleteStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (user?.role !== 'Admin') return null;

  const handleSelfDelete = async (e) => {
    e.preventDefault();
    if (!selfDeletePassword) {
      toast.error('Please enter your current Admin password');
      return;
    }
    if (selfDeleteConfirmText.trim().toUpperCase() !== 'DELETE MY ACCOUNT') {
      toast.error('Please type "DELETE MY ACCOUNT" exactly to confirm');
      return;
    }

    setSelfDeleting(true);
    try {
      const { data } = await API.delete('/auth/self-delete-admin', {
        data: {
          password: selfDeletePassword,
          confirmText: selfDeleteConfirmText.trim().toUpperCase(),
        },
      });
      toast.success(data?.message || 'Admin account deleted permanently');
      onClose();
      logout();
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete Admin account');
    } finally {
      setSelfDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-card w-full max-w-md animate-slide-up my-auto overflow-hidden border border-rose-500/40 shadow-2xl shadow-rose-950/50">
        <div className="flex items-center justify-between p-6 border-b border-rose-500/30 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <HiOutlineExclamation className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-surface-100">
                Delete My Admin Account
              </h2>
              <p className="text-xs text-rose-600 dark:text-rose-300">
                Self-deletion verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={selfDeleting}
            className="p-2 rounded-lg hover:bg-surface-700/50 text-surface-400"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSelfDelete} className="p-6 space-y-4">
          <div className="p-3 rounded-lg bg-surface-800/60 border border-surface-700/50 text-xs text-surface-300">
            <span className="font-semibold text-surface-100">Protection Policy: </span>
            Nobody else has permission to delete your Admin account. Only you can authenticate and permanently delete your own account.
          </div>

          {loadingDeleteStatus ? (
            <p className="text-xs text-surface-400">Checking organization ownership impact...</p>
          ) : selfDeleteStatus?.isSoleAdmin ? (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-800 dark:text-rose-200 space-y-1">
              <p className="font-bold text-rose-700 dark:text-rose-300">
                Warning: You are the SOLE Admin of {selfDeleteStatus.companyName || 'this organization'}
              </p>
              <p className="leading-relaxed">
                Deleting your account will permanently erase your Admin profile along with {selfDeleteStatus.activeStaffCount} staff account(s) and organization records. This action cannot be undone.
              </p>
            </div>
          ) : selfDeleteStatus ? (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-bold text-amber-700 dark:text-amber-300">
                Organization will remain active ({selfDeleteStatus.otherAdminsCount} other Admin remaining)
              </p>
              <p className="leading-relaxed">
                Only your Admin account will be permanently deleted. Other Admins retain access to manage {selfDeleteStatus.companyName || 'the organization'}.
              </p>
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Current Password <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showSelfDeletePw ? 'text' : 'password'}
                required
                value={selfDeletePassword}
                onChange={(e) => setSelfDeletePassword(e.target.value)}
                className="input-field pr-10"
                placeholder="Verify your Admin password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowSelfDeletePw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
              >
                {showSelfDeletePw ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Type <code className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 font-mono text-xs font-bold">DELETE MY ACCOUNT</code> to confirm
            </label>
            <input
              type="text"
              required
              value={selfDeleteConfirmText}
              onChange={(e) => setSelfDeleteConfirmText(e.target.value)}
              className="input-field font-mono"
              placeholder="DELETE MY ACCOUNT"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={selfDeleting}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                selfDeleting ||
                !selfDeletePassword ||
                selfDeleteConfirmText.trim().toUpperCase() !== 'DELETE MY ACCOUNT'
              }
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiOutlineTrash className="w-4 h-4" />
              {selfDeleting ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminSelfDeleteModal;

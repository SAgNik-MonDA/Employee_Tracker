import React from 'react';
import { HiOutlineExclamation, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  itemName = '',
  confirmText = 'Confirm Delete',
  cancelText = 'Cancel',
  type = 'danger',
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-surface-950/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-md p-6 space-y-5 animate-slide-up border border-surface-700/60 shadow-2xl">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              type === 'danger' ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400' : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}>
              {type === 'danger' ? <HiOutlineTrash className="w-6 h-6" /> : <HiOutlineExclamation className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-surface-100">{title}</h3>
              <p className="text-xs text-surface-400 mt-0.5">Please confirm your action</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading} 
            className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-500 hover:text-surface-300 transition-colors"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Message & Item box */}
        <div className="space-y-3">
          <p className="text-sm text-surface-300 leading-relaxed">{message}</p>
          {itemName && (
            <div className="p-3 rounded-xl bg-surface-900/60 border border-surface-700/50 text-xs font-mono font-bold text-rose-300 truncate">
              {itemName}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-surface-700 hover:bg-surface-800 text-surface-300 font-semibold text-xs transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
              type === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 disabled:opacity-50'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 disabled:opacity-50'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                <HiOutlineTrash className="w-4 h-4" />
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

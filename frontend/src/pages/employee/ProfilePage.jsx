import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import ProfilePictureUploader from '../../components/common/ProfilePictureUploader';
import BankDetailsForm from '../../components/common/BankDetailsForm';
import BirthdayBanner from '../../components/common/BirthdayBanner';
import FaceRegistrationModal from '../../components/common/FaceRegistrationModal';

import toast from 'react-hot-toast';

import {
  HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff,
  HiOutlineX, HiOutlineCheck, HiOutlinePencil, HiOutlinePlus,
} from 'react-icons/hi';


// ─── Read-only Info Row ────────────────────────────────────────────────────────
const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-700/40 last:border-0">
    <span className="text-sm text-surface-500 sm:w-44 flex-shrink-0">{label}</span>
    <span className={`text-sm font-medium text-surface-200 ${mono ? 'font-mono tracking-wider' : ''}`}>
      {value || <span className="text-surface-600 italic">Not set</span>}
    </span>
  </div>
);

// ─── Role Badge ───────────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  const colors = {
    Admin:    'bg-rose-500/20 text-rose-400 border-rose-500/30',
    HR:       'bg-violet-500/20 text-violet-400 border-violet-500/30',
    Employee: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[role] || ''}`}>
      {role}
    </span>
  );
};


// ─── Main Component ───────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { user, updateSessionUser } = useAuth();
  const { notifications } = useNotifications();
  const [profile, setProfile]       = useState(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Profile Details editing
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone: '',
    alternatePhone: '',
    currentAddress: '',
    permanentAddress: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Bank Details editing
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    branchName: '',
    bankAddress: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  // Face Registration
  const [showFaceModal, setShowFaceModal] = useState(false);


  // DOB editing
  const [editingDOB, setEditingDOB] = useState(false);
  const [dobValue, setDobValue]     = useState('');
  const [savingDOB, setSavingDOB]   = useState(false);

  const [showResetModal, setShowResetModal]   = useState(false);
  const [resetForm, setResetForm]             = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [showResetPw, setShowResetPw]         = useState({ old: false, new: false, confirm: false });
  const [resetting, setResetting]             = useState(false);

  // Real-time current password verification
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState(null); // null, true, or false
  const [checkingPassword, setCheckingPassword] = useState(false);

  useEffect(() => {
    if (!resetForm.oldPassword) {
      setIsCurrentPasswordValid(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setCheckingPassword(true);
      try {
        const { data } = await API.post('/auth/check-current-password', {
          currentPassword: resetForm.oldPassword,
        });
        setIsCurrentPasswordValid(data.valid);
      } catch {
        setIsCurrentPasswordValid(false);
      } finally {
        setCheckingPassword(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounce);
  }, [resetForm.oldPassword]);

  useEffect(() => { fetchProfile(); }, []);

  // Re-fetch profile when a new notification comes in (e.g., face reset approved/rejected)
  useEffect(() => {
    if (notifications.length > 0) {
      fetchProfile();
    }
  }, [notifications.length]);

  const fetchProfile = async () => {
    try {
      const [profileRes, balanceRes] = await Promise.all([
        API.get('/auth/my-profile'),
        API.get('/leaves/my-balance').catch(() => ({ data: null }))
      ]);
      const data = profileRes.data;
      setProfile(data);
      if (balanceRes.data) setLeaveBalance(balanceRes.data);
      setDobValue(data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '');
      updateSessionUser(); // Also update global auth context
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestFaceReset = async () => {
    try {
      await API.post('/auth/request-face-reset');
      toast.success('Face reset request sent to Admin/HR.');
      fetchProfile();
    } catch (err) {
      toast.error('Failed to request face reset.');
    }
  };

  // ── Save Date of Birth ─────────────────────────────────────────────────────
  const handleSaveDOB = async () => {
    setSavingDOB(true);
    try {
      const { data } = await API.put('/auth/my-profile', { dateOfBirth: dobValue || null });
      setProfile(data);
      setEditingDOB(false);
      toast.success('Date of Birth updated! 🎂');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally {
      setSavingDOB(false);
    }
  };

  // ── Save Profile Details ───────────────────────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await API.put('/auth/my-profile', profileForm);
      setProfile(data);
      setShowProfileModal(false);
      toast.success('Profile details updated successfully! 🎉');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Save Bank Details ──────────────────────────────────────────────────────
  const handleSaveBank = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      const { data } = await API.put('/auth/my-profile', { bankDetails: bankForm });
      setProfile(data);
      setShowBankModal(false);
      toast.success('Bank details saved successfully! 🏦');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save bank details');
    } finally {
      setSavingBank(false);
    }
  };


  // ── Reset Password ─────────────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }
    setResetting(true);
    try {
      const { data } = await API.post('/auth/change-password', resetForm);
      toast.success(data.message || 'Password changed successfully! 📧');
      setShowResetModal(false);
      setResetForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setIsCurrentPasswordValid(null);
      fetchProfile(); // refresh rawPassword display
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6 animate-pulse">
          <div className="w-24 h-24 bg-surface-700 rounded-full mb-4" />
          <div className="w-48 h-6 bg-surface-700 rounded mb-2" />
          <div className="w-32 h-4 bg-surface-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Happy Birthday Celebration Banner (Only shown on birthday) ── */}
      <BirthdayBanner />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">My Profile</h1>
        <p className="text-surface-500 mt-1">View your account details</p>
      </div>



      {/* ── Profile Card ──────────────────────────────────────────────────── */}
      <div className="glass-card p-6">
        {/* Avatar + Name */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6 pb-6 border-b border-surface-700/40">
          <ProfilePictureUploader />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-display font-bold text-surface-100">{profile?.name}</h2>
            <p className="text-primary-400 font-medium mt-1">{profile?.designation || 'No designation set'}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <RoleBadge role={profile?.role} />
              {profile?.employeeCode && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                  {profile.employeeCode}
                </span>
              )}
              {profile?.faceDescriptor && profile.faceDescriptor.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Face Auth Registered">
                    <HiOutlineCheck className="w-3 h-3" /> Face Verified
                  </span>
                  {profile?.faceResetRequest === 'Pending' ? (
                    <span className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 rounded-full">Reset Pending</span>
                  ) : (
                    <button
                      onClick={handleRequestFaceReset}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-700/50 text-surface-300 border border-surface-600 hover:bg-surface-600 transition-colors"
                      title="Request Admin to allow you to set up a new face"
                    >
                      <HiOutlinePencil className="w-3 h-3" /> Request Edit
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowFaceModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
                >
                  <HiOutlinePlus className="w-3 h-3" /> Set up Face Auth
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Personal Details ──────────────────────────────── */}
        <div className="flex items-center justify-between mb-3 border-b border-surface-700/40 pb-2">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Personal Details</h3>
          <button
            onClick={() => {
              setProfileForm({
                phone: profile?.phone || '',
                alternatePhone: profile?.alternatePhone || '',
                currentAddress: profile?.currentAddress || '',
                permanentAddress: profile?.permanentAddress || '',
              });
              setShowProfileModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-xs font-semibold"
          >
            <HiOutlinePencil className="w-3.5 h-3.5" /> Edit Info
          </button>
        </div>
        <div className="mb-6">
          <InfoRow label="Full Name"     value={profile?.name} />
          <InfoRow label="Email"         value={profile?.email} />
          <InfoRow label="Employee Code" value={profile?.employeeCode} mono />
          <InfoRow label="Role"          value={profile?.role} />
          <InfoRow label="Department"    value={profile?.department} />
          <InfoRow label="Designation"   value={profile?.designation} />
          <InfoRow label="Phone"         value={profile?.phone} />
          <InfoRow label="Alternate Phone" value={profile?.alternatePhone} />
          <InfoRow label="Current Address" value={profile?.currentAddress} />
          <InfoRow label="Permanent Address" value={profile?.permanentAddress} />
          <InfoRow label="Date of Joining" value={profile?.joiningDate ? new Date(profile.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />

          {/* Date of Birth — EDITABLE */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-700/40">
            <span className="text-sm text-surface-500 sm:w-44 flex-shrink-0">Date of Birth</span>
            {editingDOB ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dobValue}
                  onChange={(e) => setDobValue(e.target.value)}
                  className="input-field py-1.5 text-sm"
                />
                <button
                  onClick={handleSaveDOB}
                  disabled={savingDOB}
                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  title="Save"
                >
                  <HiOutlineCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditingDOB(false); setDobValue(profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : ''); }}
                  className="p-2 rounded-lg bg-surface-700/50 text-surface-400 hover:bg-surface-700 transition-colors"
                  title="Cancel"
                >
                  <HiOutlineX className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-surface-200">
                  {profile?.dateOfBirth
                    ? new Date(profile.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                    : <span className="text-surface-600 italic">Not set</span>}
                </span>
                <button
                  onClick={() => setEditingDOB(true)}
                  className="p-1.5 rounded-lg hover:bg-primary-500/20 text-primary-400 transition-colors"
                  title="Edit Date of Birth"
                >
                  <HiOutlinePencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Leave Balances ────────────────────────────────────────────── */}
        {leaveBalance && (
          <>
            <div className="flex items-center justify-between mt-8 mb-3 border-b border-surface-700/40 pb-2">
              <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Leave Quota ({leaveBalance.year})</h3>
            </div>
            <div className="mb-6">
              <InfoRow label="Casual Leaves"    value={`${leaveBalance.casual.remaining} remaining (out of ${leaveBalance.casual.total})`} />
              <InfoRow label="Emergency Leaves" value={`${leaveBalance.emergency.remaining} remaining (out of ${leaveBalance.emergency.total})`} />
            </div>
          </>
        )}

        {/* ── Bank Details ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-8 mb-3 border-b border-surface-700/40 pb-2">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Bank Details</h3>
          {(!profile?.bankDetails?.accountNumber || profile?.bankDetails?.accountNumber.trim() === '') && (
            <button
              onClick={() => {
                setBankForm({
                  bankName: '',
                  branchName: '',
                  ifscCode: '',
                  bankAddress: '',
                  accountHolderName: profile?.name || '',
                  accountNumber: '',
                });
                setShowBankModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-semibold"
            >
              <HiOutlinePlus className="w-3.5 h-3.5" /> Add Bank Details
            </button>
          )}
        </div>
        <div className="mb-6">
          <InfoRow label="Bank Name"       value={profile?.bankDetails?.bankName} />
          <InfoRow label="Branch Name"      value={profile?.bankDetails?.branchName} />
          <InfoRow label="IFSC Code"        value={profile?.bankDetails?.ifscCode} mono />
          <InfoRow label="Bank Address"     value={profile?.bankDetails?.bankAddress} />
          <InfoRow label="Account Holder"   value={profile?.bankDetails?.accountHolderName} />
          <InfoRow label="Account Number"   value={profile?.bankDetails?.accountNumber ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' + profile.bankDetails.accountNumber.slice(-4) : null} />
        </div>


        {/* ── Security Section ────────────────────────────────────────────── */}
        <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Security</h3>
        <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700/50 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <HiOutlineLockClosed className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-surface-200">Password</p>
              <p className="text-xs text-surface-500">Encrypted &amp; secure</p>
            </div>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all duration-200 text-sm font-medium"
          >
            <HiOutlineLockClosed className="w-4 h-4" />
            Reset Password
          </button>
        </div>
      </div>

      {/* ── Reset Password Modal ───────────────────────────────────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <h2 className="text-xl font-display font-bold text-surface-100">🔐 Reset Password</h2>
              <button onClick={() => setShowResetModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {/* Old Password */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showResetPw.old ? 'text' : 'password'}
                    required
                    value={resetForm.oldPassword}
                    onChange={(e) => setResetForm({ ...resetForm, oldPassword: e.target.value })}
                    className={`input-field pr-10 ${
                      isCurrentPasswordValid === false ? 'border-rose-500/50' : isCurrentPasswordValid === true ? 'border-emerald-500/50' : ''
                    }`}
                    placeholder="Enter current password"
                  />
                  <button type="button" onClick={() => setShowResetPw((p) => ({ ...p, old: !p.old }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                    {showResetPw.old ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                  </button>
                </div>
                {checkingPassword && (
                  <p className="text-xs text-primary-400 mt-1 flex items-center gap-1">
                    <span className="w-3 h-3 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></span> Checking...
                  </p>
                )}
                {isCurrentPasswordValid === false && (
                  <p className="text-xs text-rose-400 mt-1">Incorrect current password</p>
                )}
                {isCurrentPasswordValid === true && (
                  <p className="text-xs text-emerald-400 mt-1">Current password matches ✅</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPw.new ? 'text' : 'password'}
                    required minLength={6}
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    className="input-field pr-10"
                    placeholder="Min 6 characters"
                  />
                  <button type="button" onClick={() => setShowResetPw((p) => ({ ...p, new: !p.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                    {showResetPw.new ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showResetPw.confirm ? 'text' : 'password'}
                    required
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    className={`input-field pr-10 ${
                      resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword
                        ? 'border-rose-500/50' : ''
                    }`}
                    placeholder="Re-enter new password"
                  />
                  <button type="button" onClick={() => setShowResetPw((p) => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300">
                    {showResetPw.confirm ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                  </button>
                </div>
                {resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword && (
                  <p className="text-xs text-rose-400 mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={
                    resetting || 
                    checkingPassword ||
                    isCurrentPasswordValid !== true || 
                    !resetForm.newPassword ||
                    (resetForm.confirmPassword && resetForm.newPassword !== resetForm.confirmPassword)
                  }
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetting ? 'Changing...' : '🔐 Change Password'}
                </button>
                <button 
                  type="button" 
                  onClick={() => { 
                    setShowResetModal(false); 
                    setResetForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                    setIsCurrentPasswordValid(null);
                  }} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-surface-500 text-center pt-1">
                📧 A confirmation email with your new password will be sent.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Profile Info Modal ─────────────────────────────────────────── */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <h2 className="text-xl font-display font-bold text-surface-100">✏️ Edit Personal Info</h2>
              <button onClick={() => setShowProfileModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="input-field"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Alternate Phone Number</label>
                <input
                  type="tel"
                  value={profileForm.alternatePhone}
                  onChange={(e) => setProfileForm({ ...profileForm, alternatePhone: e.target.value })}
                  className="input-field"
                  placeholder="+91 98765 43211"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Current Address</label>
                <textarea
                  value={profileForm.currentAddress}
                  onChange={(e) => setProfileForm({ ...profileForm, currentAddress: e.target.value })}
                  className="input-field h-20 resize-none py-2"
                  placeholder="Enter current address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Permanent Address {profile?.permanentAddress && '(Locked)'}
                </label>
                <textarea
                  value={profileForm.permanentAddress}
                  onChange={(e) => setProfileForm({ ...profileForm, permanentAddress: e.target.value })}
                  disabled={!!profile?.permanentAddress && profile.permanentAddress.trim() !== ''}
                  className="input-field h-20 resize-none py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={profile?.permanentAddress || "Enter permanent address (can only be set once)"}
                />
                {!profile?.permanentAddress && (
                  <p className="text-xs text-amber-400 mt-1">⚠️ Note: Permanent address can only be set once.</p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : '💾 Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Bank Details Modal — BankDetailsForm uses backend proxy ── */}
      {showBankModal && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <h2 className="text-xl font-display font-bold text-surface-100">🏦 Add Bank Details</h2>
              <button onClick={() => setShowBankModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="p-6 space-y-4">
              {/* Reusable Bank Form with autocomplete via /api/banks/* backend proxy */}
              <BankDetailsForm
                data={bankForm}
                onChange={(updated) => setBankForm(updated)}
              />

              <p className="text-xs text-amber-400">
                ⚠️ Note: Bank details can only be set once. Admin approval is required to edit them after saving.
              </p>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={savingBank}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {savingBank ? 'Saving...' : '💾 Save Bank Details'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Face Registration Modal ────────────────────────────────────────── */}
      <FaceRegistrationModal 
        isOpen={showFaceModal} 
        onClose={() => setShowFaceModal(false)}
        onSuccess={fetchProfile}
      />
    </div>
  );
};


export default ProfilePage;

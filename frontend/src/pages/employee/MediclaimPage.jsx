import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import MediclaimSection from '../../components/employee/MediclaimSection';
import WithdrawalRequestsSection from '../../components/employee/WithdrawalRequestsSection';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  HiOutlineShieldCheck,
  HiOutlineCurrencyRupee,
  HiOutlineClipboardList,
} from 'react-icons/hi';

const MediclaimPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Mediclaim'); // 'Mediclaim' | 'PF'

  const fetchProfile = async () => {
    try {
      const { data } = await API.get('/auth/profile');
      setProfile(data);
    } catch (error) {
      console.error('Failed to fetch profile', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) return <LoadingSpinner />;

  const activeProfile = profile || user;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
              <HiOutlineShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold font-display text-surface-100">
              Mediclaim &amp; Provident Fund (PF) Portal
            </h1>
          </div>
          <p className="text-sm text-surface-400">
            Submit medical reimbursement claims with doctor prescriptions, view accumulated PF balances, and track approvals
          </p>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex bg-surface-800 p-1.5 rounded-xl border border-surface-700/60 self-start sm:self-auto shadow-sm">
          <button
            onClick={() => setActiveTab('Mediclaim')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'Mediclaim'
                ? 'bg-teal-500 text-white shadow-md shadow-teal-500/25'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <HiOutlineShieldCheck className="w-4 h-4" />
            <span>Mediclaim Claims</span>
          </button>
          <button
            onClick={() => setActiveTab('PF')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'PF'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <HiOutlineCurrencyRupee className="w-4 h-4" />
            <span>PF Withdrawals</span>
          </button>
        </div>
      </div>

      {/* ── Active Portal View ──────────────────────────────────────── */}
      {activeTab === 'Mediclaim' ? (
        <MediclaimSection profile={activeProfile} fetchProfile={fetchProfile} />
      ) : (
        <WithdrawalRequestsSection profile={activeProfile} fetchProfile={fetchProfile} />
      )}
    </div>
  );
};

export default MediclaimPage;

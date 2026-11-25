import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/common/UserAvatar';
import BankDetailsForm from '../../components/common/BankDetailsForm';
import MeetingStatsCard from '../../components/common/MeetingStatsCard';
import ConfirmModal from '../../components/common/ConfirmModal';
import AdminSelfDeleteModal from '../../components/common/AdminSelfDeleteModal';
import toast from 'react-hot-toast';

import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineX, HiOutlineSearch, HiOutlineEye, HiOutlineShieldCheck,
} from 'react-icons/hi';

const InfoRow = ({ label, value, mono = false }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-700/40 last:border-0">
    <span className="text-sm text-surface-500 sm:w-44 flex-shrink-0">{label}</span>
    <span className={`text-sm font-medium text-surface-200 ${mono ? 'font-mono tracking-wider' : ''}`}>
      {value || <span className="text-surface-600 italic">Not set</span>}
    </span>
  </div>
);

// ─── Role color map ───────────────────────────────────────────────────────────
const getRoleBadgeClass = (role) => {
  if (role === 'Admin')   return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
  if (role === 'HR')      return 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
  // C-Suite / Executive
  if (['CEO','CTO','COO','CIO','CISO','Chief Financial Officer (CFO)','Chief Marketing Officer'].includes(role))
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  // Engineering
  if (['Frontend Engineer','Backend Engineer','Full-Stack Engineer','Mobile Developer','QA Engineer',
       'DevOps Engineer','Cloud Architect','System Administrator','Network Engineer',
       'Database Administrator','Security Analyst','Penetration Tester','Incident Responder',
       'AI/ML Engineer','Data Engineer','Data Scientist','Data Analyst'].includes(role))
    return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
  // Product / Design / Technical Writing
  if (['Product Manager','UI Designer','UX Designer','Technical Writer','IT Project Manager',
       'IT Consultant / Business Analyst','Technical Support Specialist','Technical Support Engineer'].includes(role))
    return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
  // Marketing
  if (['Director / Head of Marketing','Product Marketing Manager','Technical Product Marketer',
       'Demand Generation Manager','Email Marketing Specialist','Growth Marketer / Hacker',
       'Paid Media Specialist (PPC)','Content Marketing Manager','Technical Copywriter',
       'SEO Specialist','Social Media Manager','PR / Communications Manager',
       'Marketing Operations (MOPs) Manager'].includes(role))
    return 'bg-pink-500/20 text-pink-300 border border-pink-500/30';
  // Finance / Payroll
  if (['Payroll Manager','Accounts Payable (AP) Specialist'].includes(role))
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  // Sales / Customer
  if (['Sales Engineer','Account Manager','Account Manager (AM)','Customer Success Manager',
       'Customer Success Manager (CSM)','Implementation / Onboarding Specialist'].includes(role))
    return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
  // Management / Leadership
  if (['Project Manager','Project Lead','General Manager'].includes(role))
    return 'bg-teal-500/20 text-teal-300 border border-teal-500/30';
  // Default
  return 'bg-surface-700/50 text-surface-300 border border-surface-600/30';
};

export const ALL_ROLES = [
  'Admin',
  // C-Suite (access-control roles — kept for permissions)

  'CISO', 'Chief Financial Officer (CFO)', 'Chief Marketing Officer',
  // Engineering
  'Frontend Engineer', 'Backend Engineer', 'Full-Stack Engineer', 'Mobile Developer', 'QA Engineer',
  'DevOps Engineer', 'Cloud Architect', 'System Administrator', 'Network Engineer',
  'Database Administrator', 'Security Analyst', 'Penetration Tester', 'Incident Responder',
  'AI/ML Engineer', 'Data Engineer', 'Data Scientist', 'Data Analyst',
  // Product / Design / Writing
  'Product Manager', 'IT Consultant / Business Analyst',
  'UI Designer', 'UX Designer', 'Technical Writer',
  // Marketing
  'Director / Head of Marketing', 'Product Marketing Manager', 'Technical Product Marketer',
  'Demand Generation Manager', 'Email Marketing Specialist', 'Growth Marketer / Hacker',
  'Paid Media Specialist (PPC)', 'Content Marketing Manager', 'Technical Copywriter',
  'SEO Specialist', 'Social Media Manager', 'PR / Communications Manager',
  'Marketing Operations (MOPs) Manager',
  // Sales / Customer
  'Sales Engineer', 'Account Manager', 'Customer Success Manager', 'Implementation / Onboarding Specialist',
  // Finance / Payroll
  'Payroll Manager', 'Accounts Payable (AP) Specialist',
  // Support
  'Technical Support Specialist', 'Technical Support Engineer',
];

// ─── Role → Designation suggestions ──────────────────────────────────────────
// When a role is selected, the designation field shows context-aware suggestions.
export const ROLE_DESIGNATIONS = {
  // ── Engineering ──────────────────────────────────────────────────────────
  'Frontend Engineer':     ['Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'SDE-4', 'Software Engineer', 'Senior Software Engineer', 'Technical Lead', 'Team Lead', 'Project Manager'],
  'Backend Engineer':      ['Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'SDE-4', 'Software Engineer', 'Senior Software Engineer', 'Technical Lead', 'Team Lead', 'Project Manager'],
  'Full-Stack Engineer':   ['Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'SDE-4', 'Software Engineer', 'Senior Software Engineer', 'Technical Lead', 'Team Lead', 'Project Manager'],
  'Mobile Developer':      ['Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'SDE-4', 'Developer', 'Senior Developer', 'Technical Lead', 'Team Lead', 'Project Manager'],
  'QA Engineer':           ['Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'Test Engineer', 'Senior QA Engineer', 'QA Lead', 'Team Lead'],
  'DevOps Engineer':       ['Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'DevOps Engineer', 'Senior DevOps Engineer', 'DevOps Lead', 'Team Lead'],
  'Cloud Architect':       ['SDE-2', 'SDE-3', 'SDE-4', 'Cloud Engineer', 'Senior Cloud Engineer', 'Cloud Architect', 'Principal Architect'],
  'System Administrator':  ['System Administrator', 'Senior System Administrator', 'Lead System Administrator', 'System Architect'],
  'Network Engineer':      ['Network Engineer', 'Senior Network Engineer', 'Network Architect'],
  'Database Administrator':['DBA', 'Senior DBA', 'Lead DBA', 'Database Architect'],
  'Security Analyst':      ['Trainee', 'Security Analyst', 'Senior Security Analyst', 'Security Lead', 'Security Architect'],
  'Penetration Tester':    ['Penetration Tester', 'Senior Penetration Tester', 'Security Researcher'],
  'Incident Responder':    ['Incident Responder', 'Senior Incident Responder', 'Security Lead'],
  'AI/ML Engineer':        ['Trainee', 'SDE-1', 'SDE-2', 'ML Engineer', 'Senior ML Engineer', 'ML Lead', 'AI Architect', 'Principal ML Engineer'],
  'Data Engineer':         ['Trainee', 'SDE-1', 'SDE-2', 'Data Engineer', 'Senior Data Engineer', 'Lead Data Engineer', 'Principal Data Engineer'],
  'Data Scientist':        ['Trainee', 'Data Scientist', 'Senior Data Scientist', 'Lead Data Scientist', 'Principal Data Scientist'],
  'Data Analyst':          ['Trainee', 'Data Analyst', 'Senior Data Analyst', 'Lead Data Analyst', 'Business Analyst'],
  // ── Management ───────────────────────────────────────────────────────────
  'Product Manager':       ['Trainee', 'Associate Product Manager', 'Product Manager', 'Senior Product Manager', 'Business Analyst', 'Group Product Manager', 'Director of Product'],
  'IT Consultant / Business Analyst': ['Business Analyst', 'Senior Business Analyst', 'IT Consultant', 'Senior IT Consultant', 'Project Manager'],
  // ── Design / Writing ─────────────────────────────────────────────────────
  'UI Designer':           ['Trainee', 'UI Designer', 'Senior UI Designer', 'Lead UI Designer', 'Principal Designer'],
  'UX Designer':           ['Trainee', 'UX Designer', 'Senior UX Designer', 'Lead UX Designer', 'Principal UX Designer'],
  'Technical Writer':      ['Technical Writer', 'Senior Technical Writer', 'Lead Technical Writer'],
  // ── Marketing ────────────────────────────────────────────────────────────
  'Director / Head of Marketing': ['Director of Marketing', 'Head of Marketing', 'VP of Marketing'],
  'Product Marketing Manager':    ['Product Marketing Manager', 'Senior Product Marketing Manager', 'Director of Product Marketing'],
  'Technical Product Marketer':   ['Technical Product Marketer', 'Senior Technical Product Marketer'],
  'Demand Generation Manager':    ['Demand Generation Manager', 'Senior Demand Generation Manager'],
  'Email Marketing Specialist':   ['Email Marketing Specialist', 'Senior Email Marketing Specialist'],
  'Growth Marketer / Hacker':     ['Growth Marketer', 'Senior Growth Marketer', 'Growth Lead'],
  'Paid Media Specialist (PPC)':  ['PPC Specialist', 'Senior PPC Specialist', 'Paid Media Manager'],
  'Content Marketing Manager':    ['Content Writer', 'Content Marketing Manager', 'Senior Content Manager'],
  'Technical Copywriter':         ['Technical Copywriter', 'Senior Technical Copywriter'],
  'SEO Specialist':               ['SEO Analyst', 'SEO Specialist', 'Senior SEO Specialist', 'SEO Manager'],
  'Social Media Manager':         ['Social Media Executive', 'Social Media Manager', 'Senior Social Media Manager'],
  'PR / Communications Manager':  ['PR Executive', 'PR Manager', 'Senior PR Manager', 'Communications Director'],
  'Marketing Operations (MOPs) Manager': ['Marketing Operations Analyst', 'Marketing Operations Manager', 'Senior MOPs Manager'],
  'Chief Marketing Officer':      ['Chief Marketing Officer (CMO)', 'VP of Marketing'],
  // ── Sales / Customer ─────────────────────────────────────────────────────
  'Sales Engineer':        ['Trainee', 'Sales Engineer', 'Senior Sales Engineer', 'Principal Sales Engineer'],
  'Account Manager (AM)':  ['Account Manager', 'Account Executive', 'Account Manager (AM)', 'Senior Account Manager', 'Key Account Manager'],
  'Customer Success Manager':            ['CSM Associate', 'Customer Success Manager (CSM)', 'Senior CSM', 'Principal CSM'],
  'Customer Success Manager (CSM)':      ['CSM Associate', 'Customer Success Manager (CSM)', 'Senior CSM', 'Principal CSM'],
  'Implementation / Onboarding Specialist': ['Implementation Specialist', 'Senior Implementation Specialist', 'Onboarding Lead'],
  // ── Finance / Payroll ────────────────────────────────────────────────────
  'Payroll Manager':                     ['Payroll Executive', 'Payroll Manager', 'Senior Payroll Manager', 'Payroll Lead'],
  'Accounts Payable (AP) Specialist':    ['AP Executive', 'AP Specialist', 'Senior AP Specialist', 'AP Manager'],
  'Chief Financial Officer (CFO)':       ['Chief Financial Officer (CFO)', 'VP of Finance', 'Director of Finance'],
  // ── Support ──────────────────────────────────────────────────────────────
  'Technical Support Specialist':  ['Trainee', 'Technical Support Specialist', 'Senior Support Specialist', 'Support Team Lead'],
  'Technical Support Engineer':    ['Trainee', 'Technical Support Engineer', 'Senior Support Engineer', 'Support Lead'],
  // ── HR ───────────────────────────────────────────────────────────────────
  'HR': ['HR', 'HR Executive', 'HR Associate', 'HR Manager', 'Senior HR Manager', 'HR Business Partner', 'HR Director', 'Executive Assistant'],
  // ── Admin ────────────────────────────────────────────────────────────────
  'Admin': ['System Administrator', 'IT Administrator', 'Operations Manager', 'Office Manager', 'Executive Assistant'],
  // ── Security / Compliance ────────────────────────────────────────────────
  'CISO': ['Chief Information Security Officer (CISO)', 'VP of Security'],
};

// Fallback: designations shown when no matching role is found
export const GENERIC_DESIGNATIONS = [
  'Trainee', 'SDE-1', 'SDE-2', 'SDE-3', 'SDE-4',
  'Software Engineer', 'Senior Software Engineer', 'Developer', 'Senior Developer',
  'Technical Lead', 'Team Lead', 'Project Manager', 'Program Manager',
  'Delivery Manager', 'Operations Manager', 'Business Analyst', 'Account Manager',
  'Executive Assistant', 'HR', 'HR Executive', 'HR Manager',
  'Director', 'Director of Technology', 'Vice President (VP)',
  'Chief Technology Officer (CTO)', 'Chief Executive Officer (CEO)',
  'Chief Operating Officer (COO)', 'Chief Information Officer (CIO)', 'Managing Director',
];


// Returns designation suggestions for a given role string
const getDesignationsForRole = (role) => {
  if (!role) return GENERIC_DESIGNATIONS;
  // Exact match
  if (ROLE_DESIGNATIONS[role]) return ROLE_DESIGNATIONS[role];
  // Partial match (handles free-typed roles)
  const key = Object.keys(ROLE_DESIGNATIONS).find(
    (k) => role.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(role.toLowerCase())
  );
  return key ? ROLE_DESIGNATIONS[key] : GENERIC_DESIGNATIONS;
};


export const ALL_DEPARTMENTS = [
  'Engineering', 'Technical', 'Marketing', 'Finance', 'Human Resources',
  'Executive Leadership Team', 'Product', 'Design', 'Sales', 'Operations',
  'Customer Success', 'Legal', 'IT', 'Data & Analytics', 'Security',
];

// Roles / departments that can see bank details
const BANK_VISIBLE_ROLES = [
  'Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist',
  'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO',
];
const BANK_VISIBLE_DEPTS = ['Finance', 'Executive Leadership Team'];

const ManageEmployees = () => {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'Admin';
  const isHR      = user?.role === 'HR';
  const canManage = isAdmin || isHR;
  const canDelete = isAdmin;
  const canSeeBankDetails =
    BANK_VISIBLE_ROLES.includes(user?.role) ||
    BANK_VISIBLE_DEPTS.includes(user?.department);

  const [employees, setEmployees]         = useState([]);
  const [recycleCount, setRecycleCount]   = useState(0);
  const [leaveBalances, setLeaveBalances]  = useState({});
  const [attStats, setAttStats]            = useState({});
  const [loading, setLoading]              = useState(true);
  const [showModal, setShowModal]          = useState(false);
  const [editingId, setEditingId]          = useState(null);
  const [search, setSearch]               = useState('');
  const [showViewModal, setShowViewModal]  = useState(false);
  const [selectedEmp, setSelectedEmp]     = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [empToDelete, setEmpToDelete]     = useState(null);
  const [deletingEmp, setDeletingEmp]     = useState(false);
  const [showSelfDeleteModal, setShowSelfDeleteModal] = useState(false);
  const [teams, setTeams]                 = useState([]);

  // ── Bonus generation modal state ───────────────────────────────────────────
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusEmp, setBonusEmp]             = useState(null);
  const [bonusAmount, setBonusAmount]       = useState('');
  const [bonusMonthYear, setBonusMonthYear] = useState('');
  const [bonusReason, setBonusReason]       = useState('');
  const [submittingBonus, setSubmittingBonus] = useState(false);

  const emptyForm = {
    name: '', email: '', password: '', role: '',
    designation: '', department: '', basicSalary: '', pfAmount: '', mediclaimAmount: '',
    employeeCode: '', phone: '', alternatePhone: '',
    permanentAddress: '', currentAddress: '', joiningDate: '', gender: '',
    weeklyHolidays: [],
  };
  const emptyBank = { bankName: '', branchName: '', ifscCode: '', bankAddress: '', accountHolderName: '', accountNumber: '' };

  const [formData, setFormData]               = useState(emptyForm);
  const [bankData, setBankData]               = useState(emptyBank);
  const [showBankSection, setShowBankSection] = useState(false);

  // Auto-fetch salary from salary structures when role + designation change (new employee only)
  useEffect(() => {
    if (editingId) return; // Don't overwrite when editing an existing employee
    if (!formData.role || !formData.designation) return;

    const fetchSalary = async () => {
      try {
        const { data } = await API.get('/salary-structures/lookup', {
          params: { role: formData.role, designation: formData.designation },
        });
        if (data.found) {
          setFormData(prev => ({
            ...prev,
            basicSalary: data.basicSalary,
            pfAmount: data.pfAmount,
            mediclaimAmount: data.mediclaimAmount,
          }));
        }
      } catch { /* silent — non-critical */ }
    };

    const timer = setTimeout(fetchSalary, 300);
    return () => clearTimeout(timer);
  }, [formData.role, formData.designation, editingId]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [empRes, balRes, statsRes, teamsRes, recycleRes] = await Promise.all([
        API.get('/auth/employees'),
        API.get('/leaves/all-balances'),
        API.get('/attendance/employee-stats').catch(() => ({ data: {} })),
        API.get('/teams').catch(() => ({ data: [] })),
        canManage
          ? API.get('/auth/recycle-bin').catch(() => ({ data: { count: 0 } }))
          : Promise.resolve({ data: { count: 0 } }),
      ]);
      setEmployees(empRes.data);
      setLeaveBalances(balRes.data);
      setAttStats(statsRes.data || {});
      setTeams(teamsRes.data || []);
      setRecycleCount(recycleRes?.data?.count ?? (recycleRes?.data?.items?.length || 0));
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Extract employee assigned Team Name & Project Name
  const getEmpTeamAndProject = (empId) => {
    if (!empId || !teams.length) return { teamName: '—', projectName: '—' };
    const matchedTeams = teams.filter((t) => {
      const isMember = Array.isArray(t.members) && t.members.some((m) => (m?._id || m) === empId);
      const isLead = (t.teamLead?._id || t.teamLead) === empId;
      return isMember || isLead;
    });
    if (!matchedTeams.length) return { teamName: 'Unassigned', projectName: 'Unassigned' };
    const teamName = matchedTeams.map((t) => t.teamId || t.name).filter(Boolean).join(', ') || 'General';
    const projectName = matchedTeams.map((t) => t.projectName).filter(Boolean).join(', ') || 'Internal';
    return { teamName, projectName };
  };

  // Month options for bonus award (1 month prior to 4 months forward)
  const bonusMonthOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let offset = -1; offset <= 4; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const val = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
      list.push({ value: val, label: `${label} (${val})` });
    }
    return list;
  }, []);

  const handleOpenBonusModal = (emp) => {
    const now = new Date();
    const currentMY = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    setBonusEmp(emp);
    setBonusAmount('');
    setBonusMonthYear(currentMY);
    setBonusReason('');
    setShowBonusModal(true);
  };

  const handleCloseBonusModal = () => {
    setShowBonusModal(false);
    setBonusEmp(null);
    setBonusAmount('');
    setBonusReason('');
  };

  const handleGenerateBonusSubmit = async (e) => {
    e.preventDefault();
    if (!bonusEmp) return;
    const numAmount = Number(bonusAmount);
    if (!bonusAmount || isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid bonus amount greater than 0');
      return;
    }

    setSubmittingBonus(true);
    try {
      const trimmedReason = bonusReason.trim();
      const { data } = await API.post('/payroll/generate-bonus', {
        employeeId: bonusEmp._id,
        amount: numAmount,
        monthYear: bonusMonthYear,
        reason: trimmedReason || 'Performance Incentive',
      });
      toast.success(data.message || `Bonus of ₹${numAmount.toLocaleString()} generated for ${bonusEmp.name}! Added to payslip 🎉`);
      handleCloseBonusModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate bonus');
    } finally {
      setSubmittingBonus(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...formData };
      if (editingId) {
        payload.bankDetails = bankData;
        await API.put(`/auth/employee/${editingId}`, payload);
        toast.success('Employee updated! 🎉');
      } else {
        if (!formData.password) { toast.error('Password is required'); setSubmitting(false); return; }
        const { data: regData } = await API.post('/auth/register', payload);
        if (regData?.emailSent === false) {
          toast(
            regData.emailError
              ? `Employee registered! Email failed: ${regData.emailError.slice(0, 140)}`
              : 'Employee registered, but credentials email delivery failed. Check SMTP settings.',
            { icon: '⚠️', duration: 6000 }
          );
        } else {
          toast.success('Employee registered & credentials PDF emailed! 🎉');
        }
      }
      setShowModal(false);
      resetForm();
      fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (emp) => {
    setEditingId(emp._id);
    setFormData({
      name: emp.name, email: emp.email, password: '',
      role: emp.role || '', designation: emp.designation || '',
      department: emp.department || '', basicSalary: emp.basicSalary || '', pfAmount: emp.pfAmount || '', mediclaimAmount: emp.mediclaimAmount || '',
      employeeCode: emp.employeeCode || '', phone: emp.phone || '',
      alternatePhone: emp.alternatePhone || '',
      permanentAddress: emp.permanentAddress || '',
      currentAddress: emp.currentAddress || '',
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : '',
      gender: emp.gender || '',
      weeklyHolidays: emp.weeklyHolidays || [],
    });
    setBankData(emp.bankDetails || emptyBank);
    setShowBankSection(true);
    setShowModal(true);
  };

  const handleDelete = (id, name) => {
    setEmpToDelete({ _id: id, name });
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!empToDelete) return;
    setDeletingEmp(true);
    try {
      await API.delete(`/auth/employee/${empToDelete._id}`);
      toast.success(`${empToDelete.name} moved to Recycle Bin (recoverable for 30 days)`);
      fetchAll();
      setEmpToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingEmp(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setBankData(emptyBank);
    setShowBankSection(false);
    setEditingId(null);
  };

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.department || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.employeeCode || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-100">
            {canManage ? 'Manage Employees' : 'Employees'}
          </h1>
          <p className="text-surface-500 mt-1">{employees.length} total members</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/recycle-bin"
              className="btn-secondary flex items-center gap-2 text-sm w-fit"
              title="View deleted employees (30-day recovery window)"
            >
              <HiOutlineTrash className="w-4 h-4 text-rose-400" />
              <span>Recycle Bin</span>
              {recycleCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {recycleCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="btn-primary flex items-center gap-2 w-fit"
            >
              <HiOutlinePlus className="w-5 h-5" /> Add Employee
            </button>
          </div>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="relative mb-6">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 w-5 h-5" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-12"
            placeholder="Search by name, email, department or employee code..."
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Project</th>
                <th>Team</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Phone</th>
                <th>Salary</th>
                <th>Total Casual</th>
                <th className="text-center">Rem. Casual</th>
                <th className="text-center">Total Emergency</th>
                <th className="text-center">Rem. Emergency</th>
                <th className="text-center">No. of Present</th>
                <th className="text-center">No. of Absent</th>
                <th className="text-center">No. of Offline</th>
                <th className="text-center">No. of Leave</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canManage ? 19 : 18} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={canManage ? 19 : 18} className="text-center py-8 text-surface-500">No employees found</td></tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const bal = leaveBalances[emp._id] || {
                    casualTotal: 24, casualRemaining: 24,
                    emergencyTotal: 16, emergencyRemaining: 16,
                  };
                  const empTP = getEmpTeamAndProject(emp._id);
                  return (
                    <tr key={emp._id}>
                      <td>
                        <div
                          onClick={() => { setSelectedEmp(emp); setShowViewModal(true); }}
                          className="flex items-center gap-3 cursor-pointer group w-fit"
                          title="View Employee Profile"
                        >
                          <UserAvatar user={emp} size="sm" />
                          <span className="font-medium text-surface-200 group-hover:text-primary-400 group-hover:underline transition-all">
                            {emp.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2 py-1 rounded">
                          {emp.employeeCode || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 whitespace-nowrap">
                          {empTP.projectName}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 whitespace-nowrap">
                          {empTP.teamName}
                        </span>
                      </td>
                      <td className="text-surface-400">{emp.email}</td>
                      {/* ── Role badge with color + small text for long names ── */}
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border leading-tight text-center max-w-[120px] ${
                          emp.role && emp.role.length > 12 ? 'text-[10px]' : 'text-xs'
                        } ${getRoleBadgeClass(emp.role)}`}
                          style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2' }}
                        >
                          {emp.role}
                        </span>
                      </td>
                      <td>{emp.department || '—'}</td>
                      <td>{emp.designation || '—'}</td>
                      <td className="text-surface-400">{emp.phone || '—'}</td>
                      <td className="text-surface-200 font-medium">₹{emp.basicSalary?.toLocaleString()}</td>

                      <td className="text-center"><span className="text-surface-300 font-medium">{bal.casualTotal}</span></td>
                      <td className="text-center">
                        <span className={`font-bold ${bal.casualRemaining === 0 ? 'text-rose-400' : bal.casualRemaining <= 6 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {bal.casualRemaining}
                        </span>
                      </td>
                      <td className="text-center"><span className="text-surface-300 font-medium">{bal.emergencyTotal}</span></td>
                      <td className="text-center">
                        <span className={`font-bold ${bal.emergencyRemaining === 0 ? 'text-rose-400' : bal.emergencyRemaining <= 4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {bal.emergencyRemaining}
                        </span>
                      </td>

                      {/* ── Attendance stats columns ── */}
                      {(() => {
                        const s = attStats[emp._id] || { totalPresent: 0, totalAbsent: 0, totalOffline: 0, totalLeaves: 0 };
                        return (
                          <>
                            <td className="text-center"><span className="font-bold text-emerald-400">{s.totalPresent}</span></td>
                            <td className="text-center"><span className="font-bold text-rose-400">{s.totalAbsent}</span></td>
                            <td className="text-center"><span className="font-bold text-surface-300">{s.totalOffline}</span></td>
                            <td className="text-center"><span className="font-bold text-violet-400">{s.totalLeaves}</span></td>
                          </>
                        );
                      })()}

                      {canManage && (
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenBonusModal(emp)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                              title="Generate Bonus"
                            >
                              <span>🎁</span>
                              <span>Bonus</span>
                            </button>
                            <button
                              onClick={() => { setSelectedEmp(emp); setShowViewModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-primary-500/20 text-primary-400 transition-colors"
                              title="View Details"
                            >
                              <HiOutlineEye className="w-4 h-4" />
                            </button>
                            {!(isHR && emp.role === 'Admin') && (
                              <button onClick={() => handleEdit(emp)} className="p-1.5 rounded-lg hover:bg-primary-500/20 text-primary-400 transition-colors" title="Edit">
                                <HiOutlinePencil className="w-4 h-4" />
                              </button>
                            )}
                            {/* Regular employee delete (moves to 30-day Recycle Bin) */}
                            {canDelete && emp.role !== 'Admin' && (
                              <button
                                onClick={() => handleDelete(emp._id, emp.name)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="Move to Recycle Bin (30-day recovery)"
                              >
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            )}

                            {/* Admin Self-Delete: Only the Admin themselves can delete their own Admin account */}
                            {emp.role === 'Admin' && emp._id === user?._id && (
                              <button
                                onClick={() => setShowSelfDeleteModal(true)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                                title="Delete My Admin Account (Self-Delete)"
                              >
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            )}

                            {/* Another Admin: Protected from deletion by anyone else */}
                            {emp.role === 'Admin' && emp._id !== user?._id && (
                              <span
                                className="p-1.5 rounded-lg text-[#3F5C00] dark:text-[#D2F801] bg-[#D2F801]/15 border border-[#84B800]/30 dark:border-[#D2F801]/30 inline-flex items-center"
                                title="Protected: Only this Admin can delete their own account (nobody else can delete an Admin)"
                              >
                                <HiOutlineShieldCheck className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add/Edit Employee Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <h2 className="text-xl font-display font-bold text-surface-100">
                {editingId ? 'Edit Employee' : 'Add New Employee'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-surface-700 text-surface-400">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name + Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Full Name *</label>
                  <input type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Employee Code</label>
                  <input type="text" value={formData.employeeCode}
                    readOnly
                    className="input-field bg-surface-800/30 cursor-not-allowed text-surface-400" placeholder={editingId ? '' : 'Auto-generated'} />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Email *</label>
                  <input type="email" required value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field" placeholder="john@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Phone Number</label>
                  <input type="tel" value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field" placeholder="+91 98765 43210" />
                </div>
              </div>

              {/* Alternate Phone + Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Alternate Phone</label>
                  <input type="tel" value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                    className="input-field" placeholder="+91 98765 43211" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Gender</label>
                  <select
                    value={formData.gender || ''}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Default / Unspecified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Password {editingId ? '(leave blank to keep current)' : '*'}
                </label>
                <input type="text" value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field font-mono" placeholder="Min 6 characters"
                  required={!editingId} />
              </div>

              {/* Role + Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Role *</label>
                  <input
                    type="text" required list="employee-roles"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="input-field" placeholder="Type or select role"
                  />
                  <datalist id="employee-roles">
                    {(isHR ? ALL_ROLES.filter((r) => r !== 'Admin') : ALL_ROLES).map(r => <option key={r} value={r} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Department</label>
                  <input
                    type="text" list="employee-depts"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="input-field" placeholder="Type or select department"
                  />
                  <datalist id="employee-depts">
                    {ALL_DEPARTMENTS.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
              </div>

              {/* Designation + Salary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Designation
                    {formData.role && (
                      <span className="ml-1.5 text-[10px] text-primary-400 font-normal">suggestions based on role</span>
                    )}
                  </label>
                  <input
                    type="text"
                    list="employee-designations"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="input-field"
                    placeholder={formData.role ? 'Type or select designation...' : 'Software Engineer'}
                  />
                  <datalist id="employee-designations">
                    {getDesignationsForRole(formData.role).map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Basic Salary (₹)</label>
                  <input type="number" value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                    className="input-field" placeholder="50000" />
                </div>
              </div>

              {/* PF and Mediclaim */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">PF Amount (₹)</label>
                  <input type="number" value={formData.pfAmount}
                    onChange={(e) => setFormData({ ...formData, pfAmount: Number(e.target.value) })}
                    className="input-field" placeholder="1800" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Mediclaim (₹)</label>
                  <input type="number" value={formData.mediclaimAmount}
                    onChange={(e) => setFormData({ ...formData, mediclaimAmount: Number(e.target.value) })}
                    className="input-field" placeholder="500" />
                </div>
              </div>

              {/* Date of Joining */}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Date of Joining</label>
                <input type="date" value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  className="input-field" />
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Current Address</label>
                  <textarea value={formData.currentAddress}
                    onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                    className="input-field h-16 resize-none py-1.5 text-sm" placeholder="Current address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">Permanent Address</label>
                  <textarea value={formData.permanentAddress}
                    onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                    className="input-field h-16 resize-none py-1.5 text-sm" placeholder="Permanent address" />
                </div>
              </div>


              {/* Bank Details — Edit mode only */}
              {showBankSection && (
                <div className="border-t border-surface-700/40 pt-4 mt-2">
                  <h4 className="text-sm font-bold text-primary-400 mb-3">🏦 Bank Details</h4>
                  <BankDetailsForm
                    data={bankData}
                    onChange={(updated) => setBankData(updated)}
                  />
                </div>
              )}

              {!showBankSection && !editingId && (
                <p className="text-xs text-surface-500 bg-surface-800/50 rounded-lg px-3 py-2 border border-surface-700/40">
                  ℹ️ Bank details can be added after employee registration via the edit (✏️) option.
                </p>
              )}

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
                  {submitting ? 'Saving...' : editingId ? '✏️ Update Employee' : '➕ Register Employee'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Employee Details Modal ──────────────────────────────────────── */}
      {showViewModal && selectedEmp && (
        <div className="fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-surface-700/50">
              <h2 className="text-xl font-display font-bold text-surface-100">Employee Details</h2>
              <button
                onClick={() => { setShowViewModal(false); setSelectedEmp(null); }}
                className="p-2 rounded-lg hover:bg-surface-700 text-surface-400"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-surface-700/40">
                <UserAvatar user={selectedEmp} size="xl" />
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-display font-bold text-surface-100">{selectedEmp.name}</h2>
                  <p className="text-primary-400 font-medium mt-1">{selectedEmp.designation || 'No designation set'}</p>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeClass(selectedEmp.role)}`}>
                      {selectedEmp.role}
                    </span>
                    {selectedEmp.employeeCode && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                        {selectedEmp.employeeCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Personal & Project Details</h3>
                <div className="mb-4">
                  <InfoRow label="Full Name"         value={selectedEmp.name} />
                  <InfoRow label="Email"             value={selectedEmp.email} />
                  <InfoRow label="Employee Code"     value={selectedEmp.employeeCode} mono />
                  <InfoRow label="Role"              value={selectedEmp.role} />
                  <InfoRow label="Department"        value={selectedEmp.department} />
                  <InfoRow label="Designation"       value={selectedEmp.designation} />
                  <InfoRow label="Project Name"      value={getEmpTeamAndProject(selectedEmp._id).projectName} />
                  <InfoRow label="Team Name"         value={getEmpTeamAndProject(selectedEmp._id).teamName} />
                  <InfoRow label="Phone"             value={selectedEmp.phone} />
                  <InfoRow label="Alternate Phone"   value={selectedEmp.alternatePhone} />
                  <InfoRow label="Current Address"   value={selectedEmp.currentAddress} />
                  <InfoRow label="Permanent Address" value={selectedEmp.permanentAddress} />
                  <InfoRow label="Gender"            value={selectedEmp.gender} />
                  <InfoRow label="Date of Joining"   value={selectedEmp.joiningDate ? new Date(selectedEmp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
                  <InfoRow label="Date of Birth"     value={selectedEmp.dateOfBirth ? new Date(selectedEmp.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : null} />
                </div>
              </div>

              {/* Corporate Benefit IDs */}
              <div>
                <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Corporate Benefit IDs</h3>
                <div className="mb-4">
                  <InfoRow label="Mediclaim ID" value={selectedEmp.mediclaimId || 'Not Generated'} mono />
                  <InfoRow label="PF ID"        value={selectedEmp.pfId || 'Not Generated'} mono />
                </div>
              </div>

              {/* Financial Details */}
              {selectedEmp.basicSalary > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Financial Details</h3>
                  <div className="mb-4">
                    <InfoRow label="Basic Salary"       value={`₹${(selectedEmp.basicSalary || 0).toLocaleString()}`} />
                    <InfoRow label="PF Deduction"       value={`₹${(selectedEmp.pfAmount || 0).toLocaleString()}`} />
                    <InfoRow label="Mediclaim Deduction" value={`₹${(selectedEmp.mediclaimAmount || 0).toLocaleString()}`} />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-700/40 last:border-0">
                      <span className="text-sm text-emerald-400 sm:w-44 flex-shrink-0 font-semibold">Net Salary</span>
                      <span className="text-sm font-bold text-emerald-300">
                        ₹{((selectedEmp.basicSalary || 0) - (selectedEmp.pfAmount || 0) - (selectedEmp.mediclaimAmount || 0)).toLocaleString()}
                      </span>
                    </div>
                    <InfoRow label="Total PF Accumulated"       value={`₹${(selectedEmp.totalPfAccumulated || 0).toLocaleString()}`} />
                    <InfoRow label="Total Mediclaim Accumulated" value={`₹${(selectedEmp.totalMediclaimAccumulated || 0).toLocaleString()}`} />
                  </div>
                </div>
              )}

              {/* Bank Details — authorized roles + Finance dept */}
              {canSeeBankDetails && (
                <div>
                  <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Bank Details</h3>
                  <div className="mb-4">
                    <InfoRow label="Bank Name"       value={selectedEmp.bankDetails?.bankName} />
                    <InfoRow label="Branch Name"     value={selectedEmp.bankDetails?.branchName} />
                    <InfoRow label="IFSC Code"       value={selectedEmp.bankDetails?.ifscCode} mono />
                    <InfoRow label="Bank Address"    value={selectedEmp.bankDetails?.bankAddress} />
                    <InfoRow label="Account Holder"  value={selectedEmp.bankDetails?.accountHolderName} />
                    <InfoRow label="Account Number"  value={selectedEmp.bankDetails?.accountNumber} mono />
                  </div>
                </div>
              )}

              {/* Meeting Attendance & MOM Stats Summary */}
              <div className="pt-2">
                <MeetingStatsCard userId={selectedEmp._id} />
              </div>


              <div className="flex items-center gap-3 pt-4 border-t border-surface-700">
                <button
                  type="button"
                  onClick={() => {
                    const emp = selectedEmp;
                    setShowViewModal(false);
                    handleOpenBonusModal(emp);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                >
                  <span>🎁 Generate Bonus</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowViewModal(false); setSelectedEmp(null); }}
                  className="btn-secondary px-6"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Bonus Modal */}
      {showBonusModal && bonusEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/70 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
          <div className="glass-card w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up border-[1.5px] border-teal-500/50">
            {/* Header (Pinned / Sticky Top) */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 sm:p-6 border-b border-surface-700/50 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner select-none">
                  🎁
                </div>
                <div>
                  <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                    Generate Bonus
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Payroll Credit
                    </span>
                  </h2>
                  <p className="text-xs text-surface-400 mt-0.5">Award incentive / festive bonus added to net salary</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseBonusModal}
                className="p-2 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-700/50 transition-colors"
                title="Close"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body (Scrollable & Responsive) */}
            <form onSubmit={handleGenerateBonusSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5 custom-scrollbar">
              {/* Employee Summary Card with Teal/Green Border */}
              <div className="bg-surface-900/60 border-[1.5px] border-teal-500/40 rounded-xl p-4 space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-surface-100">{bonusEmp.name}</h3>
                    <p className="text-xs text-surface-400 font-mono">{bonusEmp.email}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-semibold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/40">
                    {bonusEmp.employeeCode || 'N/A'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-teal-500/20 text-xs">
                  <div>
                    <span className="text-surface-400 block">Project:</span>
                    <span className="font-semibold text-surface-200">
                      {getEmpTeamAndProject(bonusEmp._id).projectName}
                    </span>
                  </div>
                  <div>
                    <span className="text-surface-400 block">Team:</span>
                    <span className="font-semibold text-surface-200">
                      {getEmpTeamAndProject(bonusEmp._id).teamName}
                    </span>
                  </div>
                  <div>
                    <span className="text-surface-400 block">Base Salary:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ₹{(bonusEmp.basicSalary || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-surface-400 block">Department:</span>
                    <span className="font-semibold text-surface-200">
                      {bonusEmp.department || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Month/Year selector */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 mb-1.5">
                  Payroll Month & Year <span className="text-red-400">*</span>
                </label>
                <select
                  value={bonusMonthYear}
                  onChange={(e) => setBonusMonthYear(e.target.value)}
                  className="input-field text-sm w-full"
                  required
                >
                  {bonusMonthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-surface-400 mt-1">
                  The bonus will be added to this month's payslip and net salary.
                </p>
              </div>

              {/* Bonus Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 mb-1.5">
                  Amount of Bonus (₹) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="input-field pl-8 text-sm w-full font-semibold text-amber-600 dark:text-amber-300"
                    required
                  />
                </div>
              </div>

              {/* Bonus Reason */}
              <div>
                <label className="block text-xs font-semibold text-surface-300 mb-1.5">
                  Bonus Category / Reason
                </label>
                <input
                  type="text"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder="Select or enter bonus reason (e.g. Performance Incentive, Festive Bonus...)"
                  className="input-field text-sm w-full"
                  list="bonus-reason-suggestions"
                />
                <datalist id="bonus-reason-suggestions">
                  <option value="Performance Incentive" />
                  <option value="Festive / Festival Bonus" />
                  <option value="Project Completion Bonus" />
                  <option value="Annual Performance Bonus" />
                  <option value="Special Recognition Award" />
                  <option value="Referral Bonus" />
                </datalist>
              </div>

              {/* Live Impact Preview */}
              {Number(bonusAmount) > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-surface-300">
                    <span>Base Salary:</span>
                    <span>₹{(bonusEmp.basicSalary || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-300 font-medium">
                    <span>+ Bonus Amount:</span>
                    <span>+₹{Number(bonusAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-surface-400">
                    <span>- Standard Deductions (PF & Mediclaim):</span>
                    <span>-₹{((bonusEmp.pfAmount || 0) + (bonusEmp.mediclaimAmount || 0)).toLocaleString()}</span>
                  </div>
                  <div className="pt-1.5 border-t border-amber-500/30 flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    <span>Estimated Net Salary:</span>
                    <span>
                      ₹{Math.max(0, (bonusEmp.basicSalary || 0) - (bonusEmp.pfAmount || 0) - (bonusEmp.mediclaimAmount || 0) + Number(bonusAmount)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-700/60 sticky bottom-0 bg-surface-800/95 dark:bg-surface-800/95 pb-1">
                <button
                  type="button"
                  onClick={handleCloseBonusModal}
                  className="btn-secondary text-sm px-4 py-2"
                  disabled={submittingBonus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBonus || !bonusAmount || Number(bonusAmount) <= 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {submittingBonus ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                      <span>Generating Bonus...</span>
                    </>
                  ) : (
                    <>
                      <span>🎁 Generate Bonus</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Move to Recycle Bin Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(empToDelete)}
        onClose={() => setEmpToDelete(null)}
        onConfirm={handleConfirmDeleteEmployee}
        title="Move Employee to Recycle Bin"
        message="This employee's access will be suspended and they will move to the Recycle Bin for 30 days. You can restore them anytime within 30 days before automatic permanent deletion."
        itemName={empToDelete?.name}
        confirmText="Move to Recycle Bin"
        loading={deletingEmp}
      />

      {/* Admin Self-Delete Account Modal (Only Admin can self-delete their own account) */}
      <AdminSelfDeleteModal
        isOpen={showSelfDeleteModal}
        onClose={() => setShowSelfDeleteModal(false)}
      />
    </div>
  );
};

export default ManageEmployees;

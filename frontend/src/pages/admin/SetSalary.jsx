import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  HiOutlineSave, HiOutlineRefresh, HiOutlinePencil,
  HiOutlineTrash, HiOutlineCurrencyRupee,
} from 'react-icons/hi';
import { ALL_ROLES, ROLE_DESIGNATIONS, GENERIC_DESIGNATIONS } from './ManageEmployees';

const getDesignationsForRole = (role) => {
  if (!role) return GENERIC_DESIGNATIONS;
  if (ROLE_DESIGNATIONS[role]) return ROLE_DESIGNATIONS[role];
  const key = Object.keys(ROLE_DESIGNATIONS).find(
    (k) => role.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(role.toLowerCase())
  );
  return key ? ROLE_DESIGNATIONS[key] : GENERIC_DESIGNATIONS;
};

const SetSalary = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [structures, setStructures] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    role: '',
    designation: '',
    basicSalary: '',
    pfAmount: '',
    mediclaimAmount: '',
  });

  useEffect(() => {
    fetchStructures();
  }, []);

  // Auto-fill when role+designation match existing structure
  useEffect(() => {
    if (formData.role && formData.designation && structures.length > 0) {
      const existing = structures.find(
        s => s.role === formData.role && s.designation === formData.designation
      );
      if (existing) {
        setFormData(prev => ({
          ...prev,
          basicSalary: existing.basicSalary,
          pfAmount: existing.pfAmount,
          mediclaimAmount: existing.mediclaimAmount,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          basicSalary: '',
          pfAmount: '',
          mediclaimAmount: '',
        }));
      }
    }
  }, [formData.role, formData.designation, structures]);

  const fetchStructures = async () => {
    try {
      const { data } = await API.get('/salary-structures');
      setStructures(data);
    } catch (error) {
      toast.error('Failed to fetch salary structures');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.role || !formData.designation) {
      return toast.error('Please select both Role and Designation');
    }
    if (!formData.basicSalary || Number(formData.basicSalary) <= 0) {
      return toast.error('Please enter a valid Basic Salary');
    }

    setSubmitting(true);
    try {
      await API.put('/salary-structures', formData);
      toast.success('Salary structure saved successfully');
      fetchStructures();
      setFormData({ role: '', designation: '', basicSalary: '', pfAmount: '', mediclaimAmount: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save salary structure');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (s) => {
    setFormData({
      role: s.role,
      designation: s.designation,
      basicSalary: s.basicSalary,
      pfAmount: s.pfAmount,
      mediclaimAmount: s.mediclaimAmount,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salary structure?')) return;
    try {
      await API.delete(`/salary-structures/${id}`);
      toast.success('Salary structure deleted');
      fetchStructures();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100 flex items-center gap-2">
          <HiOutlineCurrencyRupee className="w-7 h-7 text-primary-400" />
          Set Salary Structure
        </h1>
        <p className="text-surface-500 mt-1">Define standardized salary, PF, and Mediclaim by Role & Designation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Form Card ────────────────────────────────────────────────── */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-bold text-surface-100 mb-6">
            {formData.role && formData.designation
              ? `Configure: ${formData.role} — ${formData.designation}`
              : 'New Salary Structure'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, designation: '' })}
                className="input-field"
              >
                <option value="">-- Select Role --</option>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Designation */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                Designation
                {formData.role && (
                  <span className="ml-1.5 text-[10px] text-primary-400 font-normal">suggestions based on role</span>
                )}
              </label>
              <input
                type="text"
                list="salary-designations"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="input-field"
                placeholder={formData.role ? 'Type or select designation...' : 'Select role first'}
              />
              <datalist id="salary-designations">
                {getDesignationsForRole(formData.role).map(d => <option key={d} value={d} />)}
              </datalist>
            </div>

            {/* Basic Salary */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">Basic Salary (₹)</label>
              <input
                type="number"
                value={formData.basicSalary}
                onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                className="input-field"
                placeholder="e.g. 50000"
                min="0"
              />
            </div>

            {/* PF + Mediclaim */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">PF Amount (₹)</label>
                <input
                  type="number"
                  value={formData.pfAmount}
                  onChange={(e) => setFormData({ ...formData, pfAmount: e.target.value })}
                  className="input-field"
                  placeholder="e.g. 1800"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Mediclaim (₹)</label>
                <input
                  type="number"
                  value={formData.mediclaimAmount}
                  onChange={(e) => setFormData({ ...formData, mediclaimAmount: e.target.value })}
                  className="input-field"
                  placeholder="e.g. 500"
                  min="0"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <HiOutlineSave className="w-4 h-4" />
                  Save Salary Structure
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Table Card ───────────────────────────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-bold text-surface-100">
              Configured Structures ({structures.length})
            </h2>
            <button
              onClick={fetchStructures}
              className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
              title="Refresh"
            >
              <HiOutlineRefresh className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-3 border-surface-600 border-t-primary-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-surface-400">Loading...</p>
            </div>
          ) : structures.length === 0 ? (
            <div className="text-center py-12">
              <HiOutlineCurrencyRupee className="w-12 h-12 mx-auto text-surface-700 mb-3" />
              <p className="text-surface-400 font-medium">No salary structures configured yet</p>
              <span className="text-xs text-surface-500">Use the form to add your first structure.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase tracking-wider">
                    <th className="pb-3 pl-4 font-medium">Role</th>
                    <th className="pb-3 font-medium">Designation</th>
                    <th className="pb-3 font-medium text-right">Salary</th>
                    <th className="pb-3 font-medium text-right">PF</th>
                    <th className="pb-3 font-medium text-right">Mediclaim</th>
                    <th className="pb-3 pr-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {structures.map((s) => (
                    <tr key={s._id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="py-3 pl-4 text-sm text-surface-200 font-medium">{s.role}</td>
                      <td className="py-3 text-sm text-surface-400">{s.designation}</td>
                      <td className="py-3 text-sm text-emerald-400 text-right font-semibold">₹{s.basicSalary.toLocaleString()}</td>
                      <td className="py-3 text-sm text-amber-400 text-right font-semibold">₹{s.pfAmount.toLocaleString()}</td>
                      <td className="py-3 text-sm text-sky-400 text-right font-semibold">₹{s.mediclaimAmount.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(s)}
                            className="p-1.5 text-surface-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors"
                            title="Edit"
                          >
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(s._id)}
                              className="p-1.5 text-surface-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                              title="Delete"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetSalary;

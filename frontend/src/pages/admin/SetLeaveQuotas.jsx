import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import { HiOutlineSave, HiOutlineRefresh, HiOutlineLockClosed, HiOutlineLockOpen, HiOutlineInformationCircle } from 'react-icons/hi';
import { GENERIC_DESIGNATIONS, ROLE_DESIGNATIONS, ALL_DEPARTMENTS } from './ManageEmployees';

const SetLeaveQuotas = () => {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    designation: '',
    department: '',
    year: new Date().getFullYear(),
    casualLeaves: '',
    emergencyLeaves: '',
  });

  const [allDesignations, setAllDesignations] = useState([]);
  const [designationToDeptMap, setDesignationToDeptMap] = useState({});
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // Generate a unique list of designations for the dropdown
    // Note: since we can't easily import from ManageEmployees if it's not exported,
    // we'll just fetch unique roles from backend or hardcode a comprehensive list.
    // For now we'll fetch all users and extract their unique designations to populate the list, 
    // PLUS a few common ones.
    const fetchInitialData = async () => {
      try {
        const [yearRes, usersRes, configsRes] = await Promise.all([
          API.get('/settings/leave-year'),
          API.get('/auth/employees'),
          API.get(`/leave-configs?year=${formData.year}`)
        ]);
        
        setActiveYear(yearRes.data.activeYear);
        setConfigs(configsRes.data);

        // Use exactly all designations present in Add Employee
        const designationsSet = new Set();
        
        // Add all generic fallback designations
        GENERIC_DESIGNATIONS.forEach(d => designationsSet.add(d));

        // Add all possible designations derived from roles
        Object.values(ROLE_DESIGNATIONS).forEach(designationArray => {
          designationArray.forEach(d => designationsSet.add(d));
        });

        setAllDesignations(Array.from(designationsSet).sort());

        // Smart Suggestion Logic: Map designation -> available departments based on actual employees
        const map = {};
        usersRes.data.forEach(u => {
          const des = u.designation && u.designation.trim() !== '' ? u.designation : u.role;
          if (des && u.department) {
            if (!map[des]) map[des] = new Set();
            map[des].add(u.department);
          }
        });
        
        // Convert Sets to Arrays
        const finalMap = {};
        Object.keys(map).forEach(k => {
          finalMap[k] = Array.from(map[k]).sort();
        });
        setDesignationToDeptMap(finalMap);

        // Add all possible designations derived from roles
        Object.values(ROLE_DESIGNATIONS).forEach(designationArray => {
          designationArray.forEach(d => designationsSet.add(d));
        });

        setAllDesignations(Array.from(designationsSet).sort());
      } catch (error) {
        toast.error('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, [formData.year]);

  // Auto-fill inputs when designation or department changes
  useEffect(() => {
    if (formData.designation && formData.department && configs.length > 0) {
      const existingConfig = configs.find(
        c => c.designation === formData.designation && c.department === formData.department
      );
      if (existingConfig) {
        setFormData(prev => ({
          ...prev,
          casualLeaves: existingConfig.casualLeaves,
          emergencyLeaves: existingConfig.emergencyLeaves
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          casualLeaves: '',
          emergencyLeaves: ''
        }));
      }
    }
  }, [formData.designation, formData.department, configs]);

  const handleGlobalYearSave = async () => {
    try {
      await API.put('/settings/leave-year', { year: activeYear });
      toast.success(`Global Active Leave Year set to ${activeYear}`);
    } catch (error) {
      toast.error('Failed to update active year');
    }
  };

  const handleConfigSubmit = async (e) => {
    e.preventDefault();
    if (!isLocked) {
      return toast.error('Please lock the quota first before saving.');
    }
    if (!formData.designation || !formData.department) {
      return toast.error('Please select both a designation and a department');
    }

    try {
      await API.put('/leave-configs', formData);
      toast.success('Leave quota updated successfully');
      // Refresh configs
      const res = await API.get(`/leave-configs?year=${formData.year}`);
      setConfigs(res.data);
      // Reset form fields but keep year, designation, and department
      setFormData(prev => ({ ...prev, casualLeaves: 0, emergencyLeaves: 0 }));
      setIsLocked(false);
    } catch (error) {
      toast.error('Failed to update leave quota');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Set Leave Quotas</h1>
        <p className="text-surface-500 mt-1">Configure casual and emergency leaves by designation</p>
      </div>

      {/* Global Settings */}
      <div className="glass-card p-6 border border-primary-500/20">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Global System Settings</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Active Leave Year</label>
            <input
              type="number"
              value={activeYear}
              onChange={(e) => setActiveYear(e.target.value)}
              className="input-field"
              min="2000"
              max="2100"
            />
          </div>
          <button onClick={handleGlobalYearSave} className="btn-primary flex items-center gap-2">
            <HiOutlineSave className="w-5 h-5" /> Save Global Year
          </button>
        </div>
        <p className="text-xs text-surface-400 mt-3">
          This controls which year's leave balance is shown to employees by default on their Apply Leave page.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Set Quota Form */}
        <div className="glass-card p-6 h-fit">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Assign Quota</h2>
          <form onSubmit={handleConfigSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Year</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                className="input-field"
                disabled={isLocked}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Designation</label>
              <select
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value, department: '' })}
                className="select-field"
                disabled={isLocked}
              >
                <option value="">-- Select Designation --</option>
                {allDesignations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="select-field"
                disabled={isLocked || !formData.designation}
              >
                <option value="">-- Select Department --</option>
                {(designationToDeptMap[formData.designation] && designationToDeptMap[formData.designation].length > 0 
                  ? designationToDeptMap[formData.designation] 
                  : ALL_DEPARTMENTS).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {formData.designation && (!designationToDeptMap[formData.designation] || designationToDeptMap[formData.designation].length === 0) && (
                <p className="text-xs text-amber-500 mt-1">No employees found for this designation. Showing all departments.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Casual Leaves</label>
              <input
                type="number"
                value={formData.casualLeaves}
                onChange={(e) => setFormData({ ...formData, casualLeaves: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="input-field"
                min="0"
                disabled={isLocked}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Emergency Leaves</label>
              <input
                type="number"
                value={formData.emergencyLeaves}
                onChange={(e) => setFormData({ ...formData, emergencyLeaves: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="input-field"
                min="0"
                disabled={isLocked}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setIsLocked(!isLocked)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-medium transition-all duration-300 ${
                  isLocked 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30' 
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30'
                }`}
              >
                {isLocked ? <HiOutlineLockOpen className="w-5 h-5" /> : <HiOutlineLockClosed className="w-5 h-5" />}
                {isLocked ? 'Unlock Quota' : 'Lock Quota'}
              </button>
              
              <button 
                type="submit" 
                disabled={!isLocked}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-medium transition-all duration-300 ${
                  isLocked
                  ? 'bg-primary-600 text-white hover:bg-primary-500 shadow-lg shadow-primary-500/30'
                  : 'bg-surface-800 text-surface-500 cursor-not-allowed border border-surface-700'
                }`}
              >
                <HiOutlineSave className="w-5 h-5" /> Save Quota
              </button>
            </div>
          </form>
        </div>

        {/* Config Table */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-surface-100">Configured Quotas ({formData.year})</h2>
            <button 
              onClick={() => {
                API.get(`/leave-configs?year=${formData.year}`).then(r => setConfigs(r.data));
              }}
              className="p-2 text-surface-400 hover:text-primary-400 bg-surface-800 rounded-lg hover:bg-surface-700 transition-colors"
              title="Refresh"
            >
              <HiOutlineRefresh className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="animate-pulse flex space-x-4 p-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-surface-700 rounded w-3/4"></div>
                <div className="h-4 bg-surface-700 rounded"></div>
                <div className="h-4 bg-surface-700 rounded w-5/6"></div>
              </div>
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-surface-500 bg-surface-800/50 rounded-xl border border-dashed border-surface-700">
              No quotas configured for {formData.year}.<br/>
              <span className="text-xs text-surface-400">Employees will fallback to 24 Casual / 16 Emergency leaves.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-700 text-surface-400 text-xs uppercase tracking-wider">
                    <th className="pb-3 pl-4 font-medium">Designation</th>
                    <th className="pb-3 font-medium text-center">Casual</th>
                    <th className="pb-3 pr-4 font-medium text-center">Emergency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {configs.map((c) => (
                    <tr key={c._id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="py-3 pl-4 text-sm text-surface-200 font-medium">{c.designation}</td>
                      <td className="py-3 text-sm text-emerald-400 text-center font-semibold">{c.casualLeaves}</td>
                      <td className="py-3 pr-4 text-sm text-amber-400 text-center font-semibold">{c.emergencyLeaves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="glass-card p-6 border border-surface-700 mt-6 bg-surface-800/30">
        <div className="flex items-start gap-3">
          <HiOutlineInformationCircle className="w-5 h-5 text-indigo-400 mt-0.5" />
          <div className="text-sm text-surface-300 space-y-1">
            <p>
              <strong className="text-indigo-400">Casual Leave:</strong> Max 24 days/year • Max 2 days/month
            </p>
            <p>
              <strong className="text-amber-400">Emergency Leave:</strong> Max 16 days/year • Distribution: 9 months×1day, 2 months×2days, 1 month max 3days
            </p>
            <p className="text-surface-400 mt-2">
              Leave dates must be within the same calendar month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetLeaveQuotas;

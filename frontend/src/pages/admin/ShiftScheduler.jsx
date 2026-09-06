import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineCalendar, HiOutlineLockClosed, HiOutlineLockOpen,
  HiOutlineTrash, HiOutlineFilter, HiOutlineRefresh,
} from 'react-icons/hi';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

const ShiftScheduler = () => {
  const [employees, setEmployees] = useState([]);
  const [mode, setMode] = useState('Weekly'); // 'Daily' or 'Weekly'
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [shiftType, setShiftType] = useState('General');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrentlyLocked, setIsCurrentlyLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(false);

  // History section state
  const now = new Date();
  const [historyMonth, setHistoryMonth] = useState(now.getMonth() + 1);
  const [historyYear, setHistoryYear] = useState(now.getFullYear());
  const [historyEmployee, setHistoryEmployee] = useState('');
  const [historyShifts, setHistoryShifts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [shiftToDelete, setShiftToDelete] = useState(null);

  const [teams, setTeams] = useState([]);

  const fetchEmployees = async () => {
    try {
      const { data } = await API.get('/auth/employees');
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to load employees');
    }
  };

  const fetchTeams = async () => {
    try {
      const { data } = await API.get('/teams');
      setTeams(data);
    } catch (error) {
      console.error('Error loading teams', error);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      let url = `/shifts/all?month=${historyMonth}&year=${historyYear}`;
      if (historyEmployee) url += `&employeeId=${historyEmployee}`;
      const { data } = await API.get(url);
      setHistoryShifts(data);
    } catch (error) {
      toast.error('Failed to load shift history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [historyMonth, historyYear, historyEmployee]);

  useEffect(() => {
    const checkLockStatus = async () => {
      if (!selectedEmployee || !startDate || !endDate) {
        setIsCurrentlyLocked(false);
        return;
      }
      setCheckingLock(true);
      try {
        const { data } = await API.get(`/shifts/${selectedEmployee}?startDate=${startDate}&endDate=${endDate}`);
        const lockedShifts = data.filter(s => s.isLocked);
        setIsCurrentlyLocked(data.length > 0 && lockedShifts.length > 0);
      } catch (error) {
        console.error('Error checking lock status', error);
      } finally {
        setCheckingLock(false);
      }
    };
    checkLockStatus();
  }, [selectedEmployee, startDate, endDate]);

  const handleStartDateChange = (e) => {
    const start = e.target.value;
    setStartDate(start);
    if (mode === 'Weekly' && start) {
      const date = new Date(start);
      date.setDate(date.getDate() + 6);
      setEndDate(date.toISOString().split('T')[0]);
    } else if (mode === 'Daily') {
      setEndDate(start);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setStartDate('');
    setEndDate('');
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !shiftType || !startDate || !endDate) {
      return toast.error('Please fill all fields');
    }

    try {
      const dates = [];
      let currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      while (currentDate <= lastDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      await API.post('/shifts/assign', { employeeId: selectedEmployee, shiftType, dates });
      toast.success('Shift assigned successfully');
      fetchHistory(); // Refresh history table
      
      if (mode === 'Weekly') {
        const nextStart = new Date(endDate);
        nextStart.setDate(nextStart.getDate() + 1);
        const nextStartStr = nextStart.toISOString().split('T')[0];
        setStartDate(nextStartStr);
        
        const nextEnd = new Date(nextStart);
        nextEnd.setDate(nextEnd.getDate() + 6);
        setEndDate(nextEnd.toISOString().split('T')[0]);
      } else {
        setStartDate('');
        setEndDate('');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error assigning shift');
    }
  };

  const handleLockToggle = async () => {
    if (!selectedEmployee || !startDate || !endDate) {
      return toast.error('Please select an employee and date range');
    }
    
    try {
      const dates = [];
      let currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      while (currentDate <= lastDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (isCurrentlyLocked) {
        const { data } = await API.put('/shifts/unlock', { employeeId: selectedEmployee, dates });
        toast.success(`Unlocked ${data.count} shift(s) successfully`);
        setIsCurrentlyLocked(false);
      } else {
        const { data } = await API.put('/shifts/lock', { employeeId: selectedEmployee, dates });
        toast.success(`Locked ${data.count} shift(s) successfully`);
        setIsCurrentlyLocked(true);
      }
      fetchHistory(); // Refresh history list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating lock status');
    }
  };

  const handleDeleteShift = async (shift) => {
    if (shift.isLocked) {
      return toast.error('Cannot delete a locked or auto-locked shift');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shiftDate = new Date(shift.date);
    shiftDate.setHours(0, 0, 0, 0);
    const lockThreshold = new Date(shiftDate.getTime() - 24 * 60 * 60 * 1000);

    if (today >= lockThreshold) {
      return toast.error('Cannot delete shift less than 1 day before it occurs or after it has passed.');
    }

    setShiftToDelete(shift);
  };

  const handleConfirmDeleteShift = async () => {
    if (!shiftToDelete) return;
    setDeletingId(shiftToDelete._id);
    try {
      await API.delete(`/shifts/${shiftToDelete._id}`);
      toast.success('Shift deleted successfully');
      fetchHistory();
      setShiftToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete shift');
    } finally {
      setDeletingId(null);
    }
  };

  const getShiftBadge = (type) => {
    switch(type) {
      case 'General': return <span className="bg-primary-500/10 text-primary-400 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-primary-500/20">{type} (10AM–6PM)</span>;
      case 'Morning': return <span className="bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-amber-500/20">{type} (6AM–2PM)</span>;
      case 'Evening': return <span className="bg-violet-500/10 text-violet-400 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-violet-500/20">{type} (2PM–10PM)</span>;
      case 'Night': return <span className="bg-slate-500/20 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-slate-500/40">{type} (10PM–6AM)</span>;
      default: return <span>{type}</span>;
    }
  };

  // Month options for filter (Last 12 months + next 3 months)
  const monthOptions = [];
  const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  for (let i = 0; i < 15; i++) {
    const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    monthOptions.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    });
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-surface-100">Shift Schedule</h2>
        <p className="text-surface-400">Assign daily or weekly shifts and manage employee shift history</p>
      </div>

      {/* Shift Info Banner Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border bg-primary-500/10 border-primary-500/20">
          <p className="text-xs font-bold text-primary-400">General Shift</p>
          <p className="text-[11px] text-surface-400 mt-0.5">10:00 AM – 6:00 PM</p>
        </div>
        <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20">
          <p className="text-xs font-bold text-amber-400">Morning Shift</p>
          <p className="text-[11px] text-surface-400 mt-0.5">6:00 AM – 2:00 PM</p>
        </div>
        <div className="p-3.5 rounded-xl border bg-blue-500/10 border-blue-500/20">
          <p className="text-xs font-bold text-blue-400">Evening Shift</p>
          <p className="text-[11px] text-surface-400 mt-0.5">2:00 PM – 10:00 PM</p>
        </div>
        <div className="p-3.5 rounded-xl border bg-violet-500/10 border-violet-500/20">
          <p className="text-xs font-bold text-violet-400">Night Shift</p>
          <p className="text-[11px] text-surface-400 mt-0.5">10:00 PM – 6:00 AM</p>
        </div>
      </div>


      <div className="flex bg-surface-800 p-1 rounded-xl w-max">
        <button
          onClick={() => handleModeChange('Daily')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'Daily' ? 'bg-primary-500 text-white shadow-md' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Daily Schedule
        </button>
        <button
          onClick={() => handleModeChange('Weekly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'Weekly' ? 'bg-primary-500 text-white shadow-md' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Weekly Schedule
        </button>
      </div>

      {/* Disclaimer for Unassigned Employees */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-300">
        <span className="text-base leading-none">ℹ️</span>
        <p className="leading-relaxed">
          <strong>Disclaimer:</strong> The employee selection list below displays <strong>unassigned employees</strong> (employees who are not currently members of any team). To schedule shifts for team members, please assign them directly within their respective Team portal under <em>Teams &rarr; Shifts</em>.
        </p>
      </div>

      {/* Assignment Card */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleAssign} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Unassigned Employee *</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select an unassigned employee...</option>
                {employees
                  .filter(emp => !teams.some(t => (t.members || []).some(m => (m._id || m) === emp._id)))
                  .map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                    </option>
                  ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Shift Type *</label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="input-field"
                required
              >
                <option value="General">General (10:00 AM - 6:00 PM)</option>
                <option value="Morning">Morning (6:00 AM - 2:00 PM)</option>
                <option value="Evening">Evening (2:00 PM - 10:00 PM)</option>
                <option value="Night">Night (10:00 PM - 6:00 AM)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => mode === 'Daily' && setEndDate(e.target.value)}
                className={`input-field ${mode === 'Weekly' ? 'opacity-50 cursor-not-allowed' : ''}`}
                readOnly={mode === 'Weekly'}
                required
              />
              {mode === 'Weekly' && <p className="text-xs text-surface-500 mt-1">Automatically calculates to 6 days ahead.</p>}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-700">
            <button 
              type="button" 
              onClick={handleLockToggle} 
              disabled={checkingLock || !selectedEmployee || !startDate || !endDate}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isCurrentlyLocked 
                  ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30' 
                  : 'bg-surface-700 text-surface-200 hover:bg-surface-600'
              }`}
            >
              {checkingLock ? (
                <span className="animate-pulse">Checking...</span>
              ) : isCurrentlyLocked ? (
                <>
                  <HiOutlineLockOpen className="w-5 h-5" />
                  Unlock Assigned Schedule
                </>
              ) : (
                <>
                  <HiOutlineLockClosed className="w-5 h-5" />
                  Lock Assigned Schedule
                </>
              )}
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <HiOutlineCalendar className="w-5 h-5" />
              Assign Shift
            </button>
          </div>
        </form>
      </div>

      {/* ─── Shift History Section ───────────────────────────────────────────── */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-surface-100 flex items-center gap-2">
              <HiOutlineCalendar className="w-5 h-5 text-primary-400" /> Shift History & Records
            </h3>
            <p className="text-xs text-surface-400">View assigned shifts sorted by date (ascending)</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-surface-900 border border-surface-700 rounded-xl px-3 py-1.5">
              <HiOutlineFilter className="w-4 h-4 text-surface-500" />
              <select
                value={`${historyMonth}-${historyYear}`}
                onChange={(e) => {
                  const [m, y] = e.target.value.split('-');
                  setHistoryMonth(parseInt(m, 10));
                  setHistoryYear(parseInt(y, 10));
                }}
                className="bg-transparent text-xs font-medium text-surface-200 focus:outline-none cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`} className="bg-surface-900 text-surface-200">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={historyEmployee}
              onChange={(e) => setHistoryEmployee(e.target.value)}
              className="bg-surface-900 border border-surface-700 rounded-xl px-3 py-1.5 text-xs font-medium text-surface-200 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-surface-900 text-surface-200">All Employees</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id} className="bg-surface-900 text-surface-200">
                  {emp.name} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                </option>
              ))}
            </select>

            <button
              onClick={fetchHistory}
              className="p-2 rounded-xl bg-surface-700/50 hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
              title="Refresh history"
            >
              <HiOutlineRefresh className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="table-container border border-surface-700/50 rounded-xl overflow-hidden">
          <table className="data-table w-full text-left">
            <thead>
              <tr>
                <th>Date ↑</th>
                <th>Employee</th>
                <th>Shift Type</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-surface-400">Loading history...</td>
                </tr>
              ) : historyShifts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-surface-400">
                    No assigned shifts found for the selected month.
                  </td>
                </tr>
              ) : (
                historyShifts.map((shift) => {
                  const sDate = new Date(shift.date);
                  const formattedDate = sDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });
                  
                  // Lookup team ID if not explicitly saved
                  const empIdStr = shift.employeeId?._id || shift.employeeId;
                  const foundTeam = teams.find(t => (t.members || []).some(m => (m._id || m) === empIdStr));
                  const effectiveTeamId = shift.teamId || foundTeam?.teamId || '';

                  return (
                    <tr key={shift._id} className="hover:bg-surface-700/30 transition-colors">
                      <td className="font-semibold text-surface-200 whitespace-nowrap">{formattedDate}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <UserAvatar user={shift.employeeId} size="xs" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-surface-200">{shift.employeeId?.name || 'Unknown'}</p>
                              {effectiveTeamId && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                                  {effectiveTeamId}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                              {shift.employeeId?.employeeCode || ''} · {shift.employeeId?.designation || shift.employeeId?.role || ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{getShiftBadge(shift.shiftType)}</td>
                      <td>
                        {shift.isAutoLocked ? (
                          <span className="text-xs font-medium bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20" title="Automatically locked (less than 1 day before shift)">
                            🔒 Auto-Locked
                          </span>
                        ) : shift.isLocked ? (
                          <span className="text-xs font-medium bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20" title="Manually locked by manager">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="text-xs font-medium bg-surface-700/50 text-surface-300 px-2.5 py-1 rounded-full border border-surface-600/30">
                            🔓 Flexible
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDeleteShift(shift)}
                          disabled={shift.isLocked || deletingId === shift._id}
                          className={`p-1.5 rounded-lg transition-colors ${
                            shift.isLocked
                              ? 'text-surface-600 cursor-not-allowed'
                              : 'hover:bg-rose-500/10 text-surface-500 hover:text-rose-400'
                          }`}
                          title={shift.isLocked ? 'Cannot delete locked/auto-locked shift' : 'Delete shift'}
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Shift Delete Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(shiftToDelete)}
        onClose={() => setShiftToDelete(null)}
        onConfirm={handleConfirmDeleteShift}
        title="Delete Shift Schedule"
        message={`Are you sure you want to delete this ${shiftToDelete?.shiftType || ''} shift for ${shiftToDelete?.employeeId?.name || 'this employee'}?`}
        itemName={shiftToDelete ? `${new Date(shiftToDelete.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${shiftToDelete.shiftType} Shift` : ''}
        confirmText="Confirm Delete Shift"
        loading={Boolean(deletingId)}
      />
    </div>
  );
};

export default ShiftScheduler;

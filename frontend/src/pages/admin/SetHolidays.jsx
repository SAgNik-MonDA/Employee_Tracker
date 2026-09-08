import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';

const SetHolidays = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [manualEditIds, setManualEditIds] = useState(new Set());

  const toggleManualEdit = (id) => {
    setManualEditIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await API.get('/auth/employees');
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleHolidayChange = (employeeId, dayIdx) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp._id === employeeId) {
          const currentHolidays = emp.weeklyHolidays || [];
          const isSelected = currentHolidays.includes(dayIdx);
          
          let newHolidays;
          if (isSelected) {
            newHolidays = currentHolidays.filter((d) => d !== dayIdx);
          } else {
            if (currentHolidays.length >= 2) {
              toast.error('Maximum 2 weekly holidays allowed per employee');
              return emp;
            }
            newHolidays = [...currentHolidays, dayIdx];
          }
          return { ...emp, weeklyHolidays: newHolidays, _isDirty: true };
        }
        return emp;
      })
    );
  };

  const handleDateChange = (empId, dateString) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e._id === empId) {
          const updates = { holidayStartDate: dateString, _isDirty: true };
          if (dateString) {
            const start = new Date(dateString);
            start.setHours(0,0,0,0);
            const validUntil = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
            updates.holidayValidUntil = validUntil.toISOString().split('T')[0];
          } else {
            updates.holidayValidUntil = '';
          }
          return { ...e, ...updates };
        }
        return e;
      })
    );
  };
  
  const handleValidUntilChange = (empId, dateString) => {
    setEmployees((prev) =>
      prev.map((e) => {
        if (e._id === empId) {
          return { ...e, holidayStartDate: dateString, _isDirty: true };
        }
        return e;
      })
    );
  };

  const handleSave = async (emp) => {
    if (!emp._isDirty) return;
    
    setSubmittingId(emp._id);
    try {
      // Use existing updateEmployee endpoint to update weeklyHolidays & start date
      const { data } = await API.put(`/auth/employee/${emp._id}`, {
        weeklyHolidays: emp.weeklyHolidays,
        holidayStartDate: emp.holidayStartDate || new Date().toISOString().split('T')[0]
      });
      toast.success(`Holidays updated for ${emp.name}`);
      
      // Update local state with the saved data from the backend to reflect changes without refresh
      setEmployees((prev) =>
        prev.map((e) => (e._id === emp._id ? { ...e, ...data, _isDirty: false } : e))
      );
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update holidays');
    } finally {
      setSubmittingId(null);
    }
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">Set Weekly Holidays</h1>
        <p className="text-surface-500 mt-1">Configure weekly off days for each employee (max 2 days).</p>
        <div className="mt-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm px-4 py-2 rounded-lg flex gap-2 items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>Once a week starts, the start date cannot be changed. Each individual holiday day becomes locked 1 day before it occurs.</p>
        </div>
      </div>

      <div className="glass-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Select Holidays</th>
                <th>Valid From (Start Date)</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-surface-500">Loading...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-surface-500">No employees found</td>
                </tr>
              ) : (
                employees.map((emp) => {
                  let isStartLocked = false;
                  const lockedDays = new Set();
                  
                  if (emp.holidayStartDate) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    const start = new Date(emp.holidayStartDate);
                    start.setHours(0,0,0,0);
                    
                    const validUntil = emp.holidayValidUntil ? new Date(emp.holidayValidUntil) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
                    validUntil.setHours(23,59,59,999);
                    
                    if (today <= validUntil) {
                      const startLockDate = new Date(start.getTime() - 24 * 60 * 60 * 1000);
                      if (today >= startLockDate) {
                        isStartLocked = true;
                      }
                      
                      for (let i = 0; i < 7; i++) {
                        const daysToAdd = (i - start.getDay() + 7) % 7;
                        const targetDate = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                        const lockDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
                        if (today >= lockDate) {
                          lockedDays.add(i);
                        }
                      }
                    }
                  }

                  // Row is entirely locked ONLY if all days are locked or we are past validUntil
                  return (
                  <tr key={emp._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-surface-200">{emp.name}</p>
                          <p className="text-[10px] font-mono text-primary-400">{emp.employeeCode || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-surface-400 text-sm">{emp.department || '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((day, idx) => {
                          const currentHolidays = emp.weeklyHolidays || [];
                          const isSelected = currentHolidays.includes(idx);
                          const isDayLocked = lockedDays.has(idx);
                          const isDisabled = (!isSelected && currentHolidays.length >= 2) || isDayLocked;
                          
                          return (
                            <div key={idx} className="relative group">
                              <button
                                onClick={() => handleHolidayChange(emp._id, idx)}
                                disabled={isDisabled || submittingId === emp._id}
                                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                                  isSelected
                                    ? 'bg-amber-500/25 text-amber-300 border-amber-500/50'
                                    : isDisabled
                                    ? 'bg-surface-800/30 text-surface-600 border-surface-700/30 cursor-not-allowed opacity-50'
                                    : 'bg-surface-800/60 text-surface-400 border-surface-700/40 hover:border-amber-500/40 hover:text-amber-400'
                                }`}
                              >
                                {day}
                              </button>
                              {isDayLocked && (
                                <div className="absolute -top-1 -right-1 text-rose-500 bg-surface-900 rounded-full">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-surface-500 w-10">Start:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              className="input-field py-1 text-xs w-[135px]"
                              value={emp.holidayStartDate ? (typeof emp.holidayStartDate === 'string' ? emp.holidayStartDate.split('T')[0] : '') : ''}
                              onChange={(e) => handleDateChange(emp._id, e.target.value)}
                              disabled={(!manualEditIds.has(emp._id) && emp.holidayStartDate) || submittingId === emp._id || isStartLocked}
                            />
                            {!isStartLocked && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleManualEdit(emp._id);
                                }}
                                disabled={submittingId === emp._id}
                                className={`p-1 rounded transition-colors ${manualEditIds.has(emp._id) ? 'bg-primary-500/20 text-primary-400' : 'text-surface-500 hover:bg-surface-800'}`}
                                title="Manually edit start date"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-surface-500 w-10">End:</span>
                          <input
                            type="date"
                            className="input-field py-1 text-xs w-[135px] opacity-60 cursor-not-allowed bg-surface-900"
                            value={emp.holidayValidUntil ? (typeof emp.holidayValidUntil === 'string' ? emp.holidayValidUntil.split('T')[0] : '') : ''}
                            readOnly
                            disabled
                          />
                        </div>
                      </div>
                      
                      {isStartLocked && (
                        <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Start Date Locked
                        </p>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleSave(emp)}
                        disabled={!emp._isDirty || submittingId === emp._id}
                        className={`btn-primary py-1 px-3 text-xs ${
                          !emp._isDirty ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {submittingId === emp._id ? 'Saving...' : 'Save'}
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
    </div>
  );
};

export default SetHolidays;

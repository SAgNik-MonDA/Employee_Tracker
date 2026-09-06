import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const MyShifts = () => {
  const { user } = useAuth();
  const [shiftBlocks, setShiftBlocks] = useState([]);
  const [todayShift, setTodayShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const { data } = await API.get(`/shifts/${user._id}`);
      
      // Group shifts into blocks
      const blocks = [];
      let currentBlock = null;

      data.forEach(shift => {
        const shiftDate = new Date(shift.date);
        shiftDate.setHours(0, 0, 0, 0);
        
        if (!currentBlock) {
          currentBlock = {
            shiftType: shift.shiftType,
            startDate: shiftDate,
            endDate: shiftDate,
            isLocked: shift.isLocked
          };
        } else {
          // Check if it's the same shift type and consecutive day
          const nextExpectedDate = new Date(currentBlock.endDate);
          nextExpectedDate.setDate(nextExpectedDate.getDate() + 1);
          nextExpectedDate.setHours(0, 0, 0, 0);
          
          if (
            shift.shiftType === currentBlock.shiftType &&
            shiftDate.getTime() === nextExpectedDate.getTime() &&
            Boolean(shift.isLocked) === Boolean(currentBlock.isLocked)
          ) {
            currentBlock.endDate = shiftDate;
          } else {
            blocks.push(currentBlock);
            currentBlock = {
              shiftType: shift.shiftType,
              startDate: shiftDate,
              endDate: shiftDate,
              isLocked: shift.isLocked
            };
          }
        }
      });
      
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      
      // Sort blocks latest first
      blocks.sort((a, b) => b.startDate - a.startDate);
      setShiftBlocks(blocks);

      // Fetch today's shift
      const localDate = new Date().toLocaleDateString('en-CA');
      const todayRes = await API.get(`/attendance/today?clientDate=${localDate}`);
      setTodayShift(todayRes.data?.expectedShift || 'General');

    } catch (error) {
      toast.error('Failed to load shift schedule');
    } finally {
      setLoading(false);
    }
  };

  const getShiftBadge = (type) => {
    switch(type) {
      case 'General': return <span className="bg-primary-500/10 text-primary-400 px-3 py-1 rounded-full text-xs font-semibold border border-primary-500/20">{type}</span>;
      case 'Morning': return <span className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/20">{type}</span>;
      case 'Evening': return <span className="bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full text-xs font-semibold border border-violet-500/20">{type}</span>;
      case 'Night': return <span className="bg-slate-500/20 text-slate-300 px-3 py-1 rounded-full text-xs font-semibold border border-slate-500/40">{type}</span>;
      default: return <span>{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-surface-100">My Shift Schedule</h2>
        <p className="text-surface-400">View your assigned shifts and working hours</p>
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


      {/* Today's Shift Section */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-surface-100 mb-2">Today's Shift</h3>
        {loading ? (
          <div className="animate-pulse flex items-center gap-3">
            <div className="h-8 w-24 bg-surface-700 rounded-full"></div>
            <div className="h-4 w-40 bg-surface-700 rounded"></div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div>{getShiftBadge(todayShift)}</div>
            <p className="text-surface-300 text-sm">
              This is your currently active shift for today.
            </p>
          </div>
        )}
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden shadow-sm">
        <div className="table-container">
          <table className="data-table w-full text-left">
            <thead>
              <tr>
                <th>Shift Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-surface-400">Loading schedule...</td>
                </tr>
              ) : shiftBlocks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-surface-400">No shifts have been assigned yet.</td>
                </tr>
              ) : (
                shiftBlocks.map((block, index) => {
                  const days = Math.round((block.endDate - block.startDate) / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <tr key={index} className="hover:bg-surface-800/80 transition-colors">
                      <td className="py-4">{getShiftBadge(block.shiftType)}</td>
                      <td className="font-medium text-surface-200">
                        {block.startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="font-medium text-surface-200">
                        {block.endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="text-surface-400 text-sm">{days} {days === 1 ? 'day' : 'days'}</td>
                      <td>
                        {block.isLocked ? (
                          <span className="text-xs font-medium bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                            🔒 Locked
                          </span>
                        ) : (
                          <span className="text-xs font-medium bg-surface-700/50 text-surface-300 px-2 py-1 rounded border border-surface-600/30">
                            🔓 Flexible
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyShifts;

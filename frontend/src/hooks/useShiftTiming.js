import { useState, useEffect } from 'react';

export const useShiftTiming = (todayStatus) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, []);

  if (!todayStatus) {
    return { canCheckIn: true, canCheckOut: true, shiftType: 'General', timeMessage: '' };
  }

  const shiftType = todayStatus.expectedShift || todayStatus.shiftAssigned || 'General';
  let startMin = 10 * 60; // 10:00 AM
  let endMin = 18 * 60;   // 6:00 PM
  
  if (shiftType === 'Morning') { startMin = 6 * 60; endMin = 14 * 60; }
  if (shiftType === 'Evening') { startMin = 14 * 60; endMin = 22 * 60; }
  if (shiftType === 'Night') { startMin = 22 * 60; endMin = 6 * 60 + 24 * 60; }

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const currentMin = hours * 60 + minutes;

  let checkMin = currentMin;
  if (shiftType === 'Night' && currentMin < 12 * 60) checkMin += 24 * 60;

  const canCheckIn = checkMin >= startMin - 5;
  const canCheckOut = checkMin >= endMin - 1 || todayStatus.earlyCheckoutStatus === 'Approved';

  let timeMessage = '';
  if (!canCheckIn && !todayStatus.checkIn) {
    const minLeft = (startMin - 5) - checkMin;
    timeMessage = `Check-in unlocks in ${minLeft} min (at ${Math.floor((startMin-5)/60)}:${String((startMin-5)%60).padStart(2,'0')})`;
  } else if (!canCheckOut && todayStatus.checkIn && !todayStatus.checkOut) {
    const minLeft = (endMin - 1) - checkMin;
    timeMessage = `Check-out unlocks in ${Math.floor(minLeft/60)}h ${minLeft%60}m (at ${Math.floor((endMin-1)/60)%24}:${String((endMin-1)%60).padStart(2,'0')})`;
  }

  return { canCheckIn, canCheckOut, shiftType, timeMessage };
};

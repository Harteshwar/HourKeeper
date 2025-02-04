// utils/timeUtils.js

// Returns start and end Date objects for today.
export const getTodayRange = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { startOfDay, endOfDay };
  };
  
  // Returns the start (Monday) and end (next Monday) for the current week.
  export const getWeekRange = (date = new Date()) => {
    const day = date.getDay(); // Sunday = 0, Monday = 1, etc.
    const diffToMonday = (day + 6) % 7; 
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return { startOfWeek, endOfWeek };
  };
  
  // Returns the start and end Date objects for the current month.
  export const getMonthRange = (date = new Date()) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { startOfMonth, endOfMonth };
  };
  
  // Calculate duration (in hours) between two Firestore timestamps.
  export const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '';
    const durationMs = new Date(checkOut.seconds * 1000) - new Date(checkIn.seconds * 1000);
    const durationHrs = durationMs / (1000 * 60 * 60);
    return durationHrs.toFixed(2) + ' hrs';
  };
  
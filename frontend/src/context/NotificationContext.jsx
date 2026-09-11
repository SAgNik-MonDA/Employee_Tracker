import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import API from '../api/axios';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { playPopSound, playRingSound, playGeneralNotificationSound } from '../utils/audioUtils';
import { HiOutlineInformationCircle, HiOutlineX, HiOutlineBriefcase } from 'react-icons/hi';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socketInstance, setSocketInstance] = useState(null);
  
  // Track currently active chat to conditionally play sound vs toast
  const [activeChatTeamId, setActiveChatTeamId] = useState(null);
  const activeChatTeamIdRef = useRef(null);

  // Modal state for Leave Quota
  const [leaveQuotaModalData, setLeaveQuotaModalData] = useState(null);

  useEffect(() => {
    activeChatTeamIdRef.current = activeChatTeamId;
  }, [activeChatTeamId]);

  const socketRef = useRef(null);
  const intervalRef = useRef(null);
  const prevUnreadCountRef = useRef(0);
  const isInitialLoad = useRef(true);
  const userIdRef = useRef(null);

  // ── Data Fetchers (no deps on user – guarded by early return) ──────
  const fetchNotifications = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const { data } = await API.get('/notifications');
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
    } catch {
      // silently ignore
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!userIdRef.current) return;
    try {
      const { data } = await API.get('/notifications/unread-count');
      setUnreadCount(data.count);
    } catch {
      // silently ignore
    }
  }, []);

  const markRead = useCallback(async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await API.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  }, []);

  // ── Play general notification sound when unreadCount increases ──────
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    } else if (unreadCount > prevUnreadCountRef.current) {
      playGeneralNotificationSound();
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // ── Main effect: socket + polling, keyed ONLY on user._id ──────────
  useEffect(() => {
    const currentUserId = user?._id;

    // Nothing changed — skip
    if (currentUserId === userIdRef.current) return;
    userIdRef.current = currentUserId;

    // Tear down previous connection
    clearInterval(intervalRef.current);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Initial fetch
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));

    // Polling fallback every 30s
    intervalRef.current = setInterval(fetchUnreadCount, 30000);

    // Socket.io real-time connection
    const socketUrl = import.meta.env.DEV
      ? window.location.origin
      : 'https://employee-tracker-backend-6t0z.onrender.com';

    const socket = io(socketUrl, {
      query: { userId: currentUserId },
      transports: ['websocket', 'polling'],
    });

    socket.on('new-notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      if (notif.type === 'leave_quota_assigned') {
        playGeneralNotificationSound();
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-sm w-full bg-surface-800 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-surface-700 cursor-pointer overflow-hidden transform hover:-translate-y-1 hover:shadow-xl transition-all duration-200 border-l-4 border-l-primary-500`}
              onClick={() => {
                toast.dismiss(t.id);
                setLeaveQuotaModalData(notif.metadata);
              }}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400">
                      <HiOutlineBriefcase className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-surface-100 mb-0.5">
                      {notif.title}
                    </p>
                    <p className="text-sm text-surface-300 line-clamp-2">
                      {notif.message}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ),
          { duration: 6000, position: 'top-right' }
        );
      }
    });

    // ── WhatsApp-like Team Chat Notifications ──────────────────────────
    socket.on('team-chat-notification', (payload) => {
      // payload = { teamId, teamName, senderName, message }
      if (activeChatTeamIdRef.current === payload.teamId) {
        // Chat is OPEN -> TeamsPage handles the in-chat sound, do nothing here.
        return;
      } else {
        // Chat is CLOSED -> Play double chime and show WhatsApp-style toast
        playRingSound();
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-sm w-full bg-surface-800 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-surface-700 cursor-pointer overflow-hidden transform hover:-translate-y-1 hover:shadow-xl transition-all duration-200`}
              onClick={() => {
                toast.dismiss(t.id);
                // Redirect to teams page and pass openChat query param
                const basePath = ['Admin','HR'].includes(user?.role) ? '/admin/teams' : '/employee/teams';
                navigate(`${basePath}?openChat=${payload.teamId}`);
              }}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md">
                      {payload.senderName?.charAt(0)?.toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-bold text-surface-100 mb-0.5">
                      {payload.senderName} <span className="text-xs font-normal text-surface-400">in {payload.teamName}</span>
                    </p>
                    <p className="text-sm text-surface-300 line-clamp-2">
                      {payload.message}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ),
          { duration: 5000, position: 'top-right' }
        );
      }
    });

    socketRef.current = socket;
    setSocketInstance(socket);

    return () => {
      clearInterval(intervalRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?._id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markRead,
        markAllRead,
        markAsRead: markRead,
        socket: socketInstance,
        activeChatTeamId,
        setActiveChatTeamId,
        openLeaveQuotaModal: setLeaveQuotaModalData,
      }}
    >
      {children}

      {/* Leave Quota Popup Modal */}
      {leaveQuotaModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-sm" onClick={() => setLeaveQuotaModalData(null)} />
          <div className="relative bg-surface-900 border border-surface-700/50 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-primary-500/10 animate-scale-up">
            <button
              onClick={() => setLeaveQuotaModalData(null)}
              className="absolute top-4 right-4 text-surface-400 hover:text-surface-100 hover:bg-surface-800 p-1 rounded-lg transition-colors"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary-500/20 text-primary-400 rounded-2xl flex items-center justify-center mb-4">
                <HiOutlineBriefcase className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold font-display text-surface-100 mb-2">
                Leave Quota Assigned
              </h2>
              <p className="text-surface-400 mb-6">
                Your annual leave balance for {leaveQuotaModalData.year} has been configured.
              </p>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-surface-800 rounded-xl p-4 border border-surface-700 text-center">
                  <div className="text-sm font-medium text-surface-400 mb-1">Casual Leaves</div>
                  <div className="text-3xl font-bold text-emerald-400 font-mono">
                    {leaveQuotaModalData.casualLeaves}
                  </div>
                </div>
                <div className="bg-surface-800 rounded-xl p-4 border border-surface-700 text-center">
                  <div className="text-sm font-medium text-surface-400 mb-1">Emergency Leaves</div>
                  <div className="text-3xl font-bold text-rose-400 font-mono">
                    {leaveQuotaModalData.emergencyLeaves}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setLeaveQuotaModalData(null)}
                className="mt-6 w-full btn-primary"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

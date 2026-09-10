import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import API from '../api/axios';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  
  // Track currently active chat to conditionally play sound vs toast
  const [activeChatTeamId, setActiveChatTeamId] = useState(null);
  const activeChatTeamIdRef = useRef(null);

  useEffect(() => {
    activeChatTeamIdRef.current = activeChatTeamId;
  }, [activeChatTeamId]);

  const socketRef = useRef(null);
  const intervalRef = useRef(null);
  const prevUnreadCountRef = useRef(0);
  const isInitialLoad = useRef(true);
  const userIdRef = useRef(null);

  // ── Notification Sound (General) ────────────────────────────────────
  const playNotificationSound = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio play failed', e);
    }
  }, []);

  // ── Chat Pop Sound (High pitch pop for open chat) ───────────────────
  const playChatPopSound = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.log('Audio play failed', e); }
  }, []);

  // ── Notification Ring Sound (Double chime for background chat) ──────
  const playNotificationRing = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();

      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playTone(523.25, ctx.currentTime, 0.2); // C5
      playTone(659.25, ctx.currentTime + 0.15, 0.3); // E5
    } catch (e) { console.log('Audio play failed', e); }
  }, []);

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
      playNotificationSound();
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount, playNotificationSound]);

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
    });

    // ── WhatsApp-like Team Chat Notifications ──────────────────────────
    socket.on('team-chat-notification', (payload) => {
      // payload = { teamId, teamName, senderName, message }
      if (activeChatTeamIdRef.current === payload.teamId) {
        // Chat is OPEN -> TeamsPage handles the in-chat sound, do nothing here.
        return;
      } else {
        // Chat is CLOSED -> Play double chime and show WhatsApp-style toast
        playNotificationRing();
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

    return () => {
      clearInterval(intervalRef.current);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?._id, navigate, playChatPopSound, playNotificationRing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markRead,
        markAllRead,
        activeChatTeamId,
        setActiveChatTeamId
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

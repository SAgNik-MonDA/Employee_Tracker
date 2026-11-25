const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const seedSuperAdmin = require('./utils/superAdminSeed');
const { startBirthdayScheduler } = require('./utils/birthdayScheduler');
const TeamChat = require('./models/TeamChat');


// Load env vars explicitly from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Connect to MongoDB
connectDB().then(() => {
  // Seed default SuperAdmin account
  seedSuperAdmin();
});

// Start birthday email scheduler (runs daily at 08:00 AM IST)
startBirthdayScheduler();

// Start holiday scheduler (runs daily at midnight to clear expired holidays)
const startHolidayScheduler = require('./utils/holidayScheduler');
startHolidayScheduler();

// Start automated payroll & fund deductions scheduler (runs on 2nd of each month at 00:05 AM IST)
const { startAutoPayrollScheduler } = require('./utils/autoPayrollScheduler');
startAutoPayrollScheduler();

// Start enterprise subscription lifecycle & auto-purge scheduler (runs daily at 00:05 AM IST)
const { startSubscriptionScheduler } = require('./utils/subscriptionScheduler');
startSubscriptionScheduler();

// Start Recycle Bin 30-day employee auto-purge scheduler
const { startRecycleBinScheduler } = require('./utils/recycleBinScheduler');
startRecycleBinScheduler();
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
global.io = io; // Make io accessible globally for Notification triggers

// Socket.io - Team Chat & Notifications
const Team = require('./models/Team');

io.on('connection', (socket) => {
  // Join user's personal room for notifications
  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(`user-${userId}`);
  }

  socket.on('join-team', async (teamId) => {
    try {
      if (userId && teamId) {
        const team = await Team.findById(teamId).select('companyId members teamLead createdBy');
        const User = require('./models/User');
        const usr = await User.findById(userId).select('companyId role _id');
        if (team && usr && usr.role !== 'SuperAdmin') {
          const userTenant = String(usr.companyId || usr._id);
          const teamTenant = String(team.companyId || '');
          if (!teamTenant || userTenant === teamTenant) {
            socket.join(`team-${teamId}`);
          }
        }
      }
    } catch { /* ignore invalid ids */ }
  });

  socket.on('team-message', async (data) => {
    // data: { teamId, senderId, senderName, senderAvatar, message }
    try {
      const team = await Team.findById(data.teamId).select('companyId members teamLead createdBy projectName');
      if (!team) return;
      const msg = await TeamChat.create({
        companyId: team.companyId || null,
        teamId: data.teamId,
        senderId: data.senderId,
        message: data.message,
      });
      const payload = {
        _id: msg._id,
        teamId: data.teamId,
        senderId: { _id: data.senderId, name: data.senderName, profilePicture: data.senderAvatar },
        message: data.message,
        isEdited: false,
        isDeleted: false,
        createdAt: msg.createdAt,
      };
      io.to(`team-${data.teamId}`).emit('team-message', payload);

      // Send chat notification to all relevant team members EXCEPT the sender
      try {
        const notifyIds = new Set();
        if (team.members) team.members.forEach(m => notifyIds.add(m.toString()));
        if (team.teamLead) notifyIds.add(team.teamLead.toString());
        if (team.createdBy) notifyIds.add(team.createdBy.toString());

        notifyIds.delete(data.senderId);

        notifyIds.forEach(memberId => {
          io.to(`user-${memberId}`).emit('team-chat-notification', {
            teamId: data.teamId,
            teamName: team.projectName,
            senderName: data.senderName,
            message: data.message,
          });
        });
      } catch (notifErr) { /* silent */ }
    } catch (e) { console.error('Chat error:', e.message); }
  });

  // Typing indicators
  socket.on('typing', (data) => {
    // data: { teamId, userId, userName }
    socket.to(`team-${data.teamId}`).emit('user-typing', {
      userId: data.userId,
      userName: data.userName,
    });
  });
  socket.on('stop-typing', (data) => {
    socket.to(`team-${data.teamId}`).emit('user-stop-typing', {
      userId: data.userId,
    });
  });

  socket.on('leave-team', (teamId) => socket.leave(`team-${teamId}`));
});

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl || req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Serve uploaded profile pictures as static files
// Access via: http://localhost:5000/uploads/avatars/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/leaves', require('./routes/leaveRoutes'));
app.use('/api/performance', require('./routes/performanceRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/banks', require('./routes/bankRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/teams',   require('./routes/teamRoutes'));
app.use('/api/shifts', require('./routes/shiftRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/leave-configs', require('./routes/leaveConfigRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/salary-structures', require('./routes/salaryStructureRoutes'));
app.use('/api/withdrawals', require('./routes/withdrawalRoutes'));
app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/landing', require('./routes/landingRoutes'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Employee Tracker API is running 🚀' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

# 🏢 Employee Tracker - Enterprise Performance, Shift & Payroll Portal

An end-to-end, production-grade **Enterprise Employee Tracking & Resource Management System** built with **React, Node.js, Express, MongoDB, TailwindCSS, and Socket.io**.

Designed with modern dark-mode glassmorphism aesthetics, real-time notifications, automated team lifecycle management, face recognition attendance checks, shift scheduling, and comprehensive payroll processing.

---

## 🌐 Live Demo
- **Frontend (Vercel):** [https://employee-tracker-project.sagnikmondal.in](https://employee-tracker-project.sagnikmondal.in)
- **Backend API (Render):** [https://employee-tracker-backend-6t0z.onrender.com](https://employee-tracker-backend-6t0z.onrender.com)

---

## ✨ Features & Highlights

### 👥 Teams Portal & Automated Archiving
- **Sequential Team ID Generation**: Auto-incrementing, continuous team identifiers (`TM-0001`, `TM-0002`, `TM-0003`...) across active and archived teams.
- **Automated Team Expiry Warnings**: Sends a warning notification 1 day prior to a project's `endDate`. Clicking the notification opens the Team Drawer with an Amber Pulse Glow on the End Date field.
- **Restricted Date Extensions**: Only Project Managers and Admins are authorized to extend project deadlines.
- **Automated & Manual History Archiving**: 100% data snapshot (members, tech stack, shift history, progress updates, documents) archived into `TeamHistory` upon completion or deletion.
- **Role-Based History Access**: Authoritative roles (Admin, HR, PMs) inspect all historical archives; employees view their own project history.
- **Monthly Analytics & Filter Bar**: Track monthly completed projects, launched projects, and total engaged members with a dynamic month filter.
- **Single Archive Deletion**: Authoritative managers can permanently remove individual history records.

### ⏱️ Shift Scheduling & Attendance System
- **Multi-Shift Roster**: Support for General (10 AM – 6 PM), Morning (6 AM – 2 PM), Evening (2 PM – 10 PM), and Night (10 PM – 6 AM) shifts.
- **Automated Shift Locking**: Auto-locks shifts 1 day prior to occurrence to prevent unauthorized modifications.
- **Face Recognition & Camera Check-in**: Verification for attendance check-ins, early check-out tracking, and face reset logs.

### 💰 Payroll & Performance Review
- **Automated Payroll Generation**: Computes basic salary, allowances, deductions, taxes, and net pay.
- **Payslip Downloads**: Employees can view and download formatted digital payslips.
- **Excel Export for Payroll**: Download beautifully styled Excel sheets for any month, detailing breakdown of net salary, PF, medical deductions, absent/late penalties, and bank details.
- **Performance Evaluation**: Multi-dimensional reviews and progress ratings.

### 🗓️ Leave Approvals & Real-Time Communications
- **Leave Request Management**: Multi-tier approvals (PM -> HR/Admin).
- **Socket.io Live Chat & Notifications**: Real-time team chat and instant push notifications.
- **Automated Schedulers**: Schedulers for employee birthday banners and holiday notifications.

### ☁️ Cloud Storage & Asset Management
- **Cloudinary Integration**: Secure cloud storage for all user avatars, PDFs, and team documents, ensuring scalable asset management without bloating local servers.

---

## 🛠️ Technology Stack

### **Frontend**
- **Core**: React 18, Vite
- **Styling**: TailwindCSS, Vanilla CSS (Glassmorphism, Custom Dark Token Theme)
- **State & Router**: React Router DOM v6, React Context API
- **Real-Time**: Socket.io-client
- **Icons & UI Feedback**: React Icons (Heroicons), React Hot Toast
- **HTTP Client**: Axios with JWT Bearer Interceptors
- **Camera / AI**: WebCam API, Face-api.js

### **Backend**
- **Runtime & Framework**: Node.js, Express.js
- **Database**: MongoDB, Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens), bcryptjs
- **Real-Time**: Socket.io
- **File Uploads**: Multer
- **Email & Automation**: Nodemailer, Node-Cron

---

## 🔌 API Endpoints Summary

### 🔐 Authentication & Employee Management (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token |
| `POST` | `/api/auth/register` | Register new employee (Admin/HR only) |
| `GET` | `/api/auth/employees` | Fetch all registered employees |
| `GET` | `/api/auth/profile` | Retrieve logged-in user profile |
| `PUT` | `/api/auth/profile` | Update profile information & picture |

### 👥 Teams & History (`/api/teams`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/teams` | Get active teams for user |
| `POST` | `/api/teams` | Create new project team |
| `GET` | `/api/teams/history/all` | Fetch archived team history |
| `DELETE` | `/api/teams/history/:id` | Delete single archived team record |
| `GET` | `/api/teams/:id` | Get detailed team details |
| `PUT` | `/api/teams/:id` | Update team info (End Date restricted to PM/Admin) |
| `DELETE` | `/api/teams/:id` | Archive and delete active team |
| `POST` | `/api/teams/:id/progress` | Submit progress update |
| `PUT` | `/api/teams/:id/progress/:updateId/approve` | Approve/Reject progress update |
| `POST` | `/api/teams/:id/documents` | Upload team document/file |
| `DELETE` | `/api/teams/:id/documents/:docId` | Delete document |
| `POST` | `/api/teams/:id/shifts` | Assign shift to team member |
| `DELETE` | `/api/teams/:id/shifts/:shiftId` | Remove team shift assignment |

### ⏱️ Attendance & Shifts (`/api/attendance`, `/api/shifts`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/attendance/check-in` | Record attendance check-in with camera verification |
| `POST` | `/api/attendance/check-out` | Record check-out & early checkout reasons |
| `GET` | `/api/attendance/my-attendance` | View logged-in user attendance history |
| `GET` | `/api/shifts/my-shifts` | Fetch assigned shift schedules |

### 💰 Payroll & Performance (`/api/payroll`, `/api/performance`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/payroll/generate` | Generate monthly payroll statements |
| `GET` | `/api/payroll/my-payslips` | Fetch employee payslips |
| `GET` | `/api/performance/reviews` | Retrieve performance reviews |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB Database (Local or MongoDB Atlas)

### 1. Clone Repository
```bash
git clone https://github.com/SAgNik-MonDA/Employee_Tracker.git
cd Employee_Tracker
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/employee_tracker
JWT_SECRET=your_jwt_secret_key_here
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```
Run Backend Server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

The application will launch on `https://employee-tracker-project.sagnikmondal.in`.

---

## 🛡️ License

This project is released under the **MIT License**.

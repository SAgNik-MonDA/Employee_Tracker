const crypto       = require('crypto');
const User         = require('../models/User');
const FaceResetLog = require('../models/FaceResetLog');
const generateToken = require('../utils/generateToken');
const sendEmail    = require('../utils/sendEmail');

// ─── Helper: safe user response (no password fields) ─────────────────────────
const userResponse = (user) => ({
  _id:              user._id,
  name:             user.name,
  email:            user.email,
  role:             user.role,
  employeeCode:     user.employeeCode     || '',
  designation:      user.designation      || '',
  department:       user.department       || '',
  phone:            user.phone            || '',
  alternatePhone:   user.alternatePhone   || '',
  permanentAddress: user.permanentAddress || '',
  currentAddress:   user.currentAddress   || '',
  bankDetails:      user.bankDetails      || { bankName: '', branchName: '', ifscCode: '', bankAddress: '', accountHolderName: '', accountNumber: '' },
  basicSalary:      user.basicSalary      || 0,
  joiningDate:      user.joiningDate,
  dateOfBirth:      user.dateOfBirth      || null,
  profilePicture:   user.profilePicture   || '',
  weeklyHolidays:   user.weeklyHolidays   || [],
  holidayStartDate: user.holidayStartDate || null,
  holidayValidUntil:user.holidayValidUntil|| null,
  faceImage:        user.faceImage        || '',
  faceDescriptor:   user.faceDescriptor   || [],
  faceResetRequest: user.faceResetRequest || 'None',
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a new employee/HR (Admin only)
// @route   POST /api/auth/register
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const {
      name, email, password, role,
      designation, department, basicSalary,
      employeeCode, phone, alternatePhone,
      permanentAddress, currentAddress, bankDetails, joiningDate,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ message: 'Employee already exists with this email address' });
    }

    let finalEmployeeCode = employeeCode;
    if (finalEmployeeCode) {
      const codeExists = await User.findOne({ employeeCode: finalEmployeeCode });
      if (codeExists) {
        return res.status(400).json({ message: `Employee code "${finalEmployeeCode}" is already taken` });
      }
    } else {
      let isUnique = false;
      let nextNumber = 1;
      
      const usersWithCodes = await User.find({ employeeCode: /^EMP-/i }, 'employeeCode');
      if (usersWithCodes.length > 0) {
         let maxNum = 0;
         usersWithCodes.forEach(u => {
            const match = u.employeeCode.match(/EMP-(\d+)/i);
            if (match) {
               const num = parseInt(match[1], 10);
               if (num > maxNum) maxNum = num;
            }
         });
         nextNumber = maxNum + 1;
      }
      
      while (!isUnique) {
        finalEmployeeCode = `EMP-${nextNumber.toString().padStart(3, '0')}`;
        const codeExists = await User.findOne({ employeeCode: finalEmployeeCode });
        if (codeExists) {
          nextNumber++;
        } else {
          isUnique = true;
        }
      }
    }

    const user = await User.create({
      name,
      email: cleanEmail,
      password,
      role:             role             || 'Employee',
      designation:      designation      || '',
      department:       department       || '',
      basicSalary:      basicSalary      || 0,
      employeeCode:     finalEmployeeCode,
      phone:            phone            || '',
      alternatePhone:   alternatePhone   || '',
      permanentAddress: permanentAddress || '',
      currentAddress:   currentAddress   || '',
      bankDetails:      bankDetails      || { bankName: '', branchName: '', ifscCode: '', bankAddress: '', accountHolderName: '', accountNumber: '' },
      joiningDate:      joiningDate      || Date.now(),
      isFirstLogin:     true,
    });

    // ── Send registration credentials email ──────────────────────────────────
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    sendEmail({
      to: cleanEmail,
      subject: '🎉 Welcome to Employee Tracker — Your Account Details',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 32px 24px;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff;">Employee Tracker</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Performance & Payroll Management</p>
          </div>
          <div style="padding:32px;">
            <h2 style="margin:0 0 8px;font-size:20px;color:#c7d2fe;">Welcome, ${name}! 👋</h2>
            <p style="color:#94a3b8;margin:0 0 24px;font-size:14px;">Your account has been created successfully. Here are your login credentials:</p>

            <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;width:150px;">Employee Code (EMP-no)</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:1px;">${finalEmployeeCode}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;">Email Address</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;">${cleanEmail}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;">Password</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:2px;">${password}</td>
                </tr>
              </table>
            </div>

            <a href="${frontendUrl}/login" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px;">
              🚀 Login to Dashboard
            </a>

            <p style="color:#ef4444;font-size:12px;margin:0;border-top:1px solid #334155;padding-top:16px;">
              ⚠️ Please keep your password safe. You can change it from your profile after logging in.
            </p>
          </div>
        </div>
      `,
    }).catch(() => {});

    res.status(201).json({
      ...userResponse(user),
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Authenticate user & return JWT
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    const { employeeCode, email, password } = req.body;
    if (!employeeCode || !email || !password) {
      return res.status(400).json({ message: 'Employee Code, Email, and Password are required' });
    }

    const cleanCode = employeeCode.trim();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if Employee Code exists (case-insensitive)
    const user = await User.findOne({
      employeeCode: { $regex: new RegExp('^' + cleanCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });

    if (!user) {
      return res.status(401).json({ message: 'Wrong Employee Code' });
    }

    // 2. Check if Email Address matches
    if (user.email.toLowerCase() !== cleanEmail) {
      return res.status(401).json({ message: 'Incorrect Email Address for this Employee Code' });
    }

    // 3. Check if Password matches
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Incorrect Password' });
    }

    // 4. Send Welcome Email on First Login
    if (user.isFirstLogin) {
      user.isFirstLogin = false;
      await user.save({ validateBeforeSave: false });

      const firstName = user.name ? user.name.split(' ')[0] : 'Employee';
      const year = new Date().getFullYear();

      sendEmail({
        to: user.email,
        subject: `🚀 Welcome to the Team, ${firstName}! Your First Login is Confirmed`,
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <div style="background:linear-gradient(135deg,#6366f1 0%,#a855f7 50%,#ec4899 100%);padding:40px 32px;text-align:center;">
              <div style="font-size:40px;margin-bottom:8px;">🎉</div>
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Welcome Aboard, ${firstName}!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">Your first login to Employee Tracker is complete</p>
            </div>

            <div style="padding:36px 32px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#c7d2fe;">Hey ${firstName}, welcome! 👋</h2>
              <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">
                We're thrilled to have you with us! You have successfully logged into your <strong style="color:#a78bfa">Employee Tracker</strong> account for the very first time.
              </p>

              <div style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(168,85,247,0.1));border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:20px;margin-bottom:28px;">
                <h3 style="margin:0 0 12px;font-size:15px;color:#f0abfc;">💡 What you can do in your portal:</h3>
                <ul style="margin:0;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.8;">
                  <li><strong>Attendance:</strong> Mark your daily Check-in &amp; Check-out with ease.</li>
                  <li><strong>Leaves:</strong> Apply for casual or emergency leaves and track your remaining balance.</li>
                  <li><strong>Performance:</strong> View your KPI reviews and feedback from management.</li>
                  <li><strong>Payslips:</strong> Download your monthly salary slips anytime.</li>
                  <li><strong>Profile &amp; Bank:</strong> Keep your personal and banking details up-to-date securely.</li>
                </ul>
              </div>

              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
                If you ever have any questions or need help navigating your dashboard, feel free to reach out to your HR or Manager.
              </p>

              <div style="border-top:1px solid #334155;padding-top:20px;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                  With warm regards,<br/>
                  <strong style="color:#94a3b8;">The Employee Tracker Team ❤️</strong><br/>
                  © ${year} Employee Tracker · All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
      }).catch((err) => console.error('First login welcome email error:', err.message));
    }

    res.json({ ...userResponse(user), token: generateToken(user._id, user.role) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in user profile (for token verify on app load)
// @route   GET /api/auth/profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(userResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in user's full profile
// @route   GET /api/auth/my-profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMyFullProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(userResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update own Date of Birth (self-editable only)
// @route   PUT /api/auth/my-profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateMyProfile = async (req, res) => {
  try {
    const { dateOfBirth, phone, alternatePhone, currentAddress, permanentAddress, bankDetails } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
    if (phone !== undefined) user.phone = phone || '';
    if (alternatePhone !== undefined) user.alternatePhone = alternatePhone || '';
    if (currentAddress !== undefined) user.currentAddress = currentAddress || '';

    // Permanent Address: Only allow if it's currently empty
    if (permanentAddress !== undefined) {
      if (!user.permanentAddress || user.permanentAddress.trim() === '') {
        user.permanentAddress = permanentAddress || '';
      } else if (permanentAddress !== user.permanentAddress) {
        return res.status(400).json({ message: 'Permanent address can only be set once' });
      }
    }

    // Bank Details: Only allow if currently unset (account number is empty)
    if (bankDetails !== undefined) {
      const hasExistingBank = user.bankDetails && user.bankDetails.accountNumber && user.bankDetails.accountNumber.trim() !== '';
      if (!hasExistingBank) {
        user.bankDetails = {
          bankName:          bankDetails.bankName          || '',
          branchName:        bankDetails.branchName        || '',
          ifscCode:          bankDetails.ifscCode          || '',
          bankAddress:       bankDetails.bankAddress       || '',
          accountHolderName: bankDetails.accountHolderName || '',
          accountNumber:     bankDetails.accountNumber     || '',
        };
      } else {
        const isMatching = 
          user.bankDetails.bankName === bankDetails.bankName &&
          user.bankDetails.branchName === bankDetails.branchName &&
          user.bankDetails.ifscCode === bankDetails.ifscCode &&
          user.bankDetails.accountHolderName === bankDetails.accountHolderName &&
          user.bankDetails.accountNumber === bankDetails.accountNumber;
        if (!isMatching) {
          return res.status(400).json({ message: 'Bank details can only be set once. Please contact Admin to make changes.' });
        }
      }
    }

    await user.save();
    res.json(userResponse(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Change own password (requires old password)
// @route   POST /api/auth/change-password
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All password fields are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect current password' });

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    // Confirmation email
    await sendEmail({
      to: user.email,
      subject: '🔐 Your Password Has Been Changed',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 32px 24px;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff;">Password Changed Successfully</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Employee Tracker Account Security</p>
          </div>
          <div style="padding:32px;">
            <p>Hi <strong>${user.name}</strong>,</p>
            <p style="color:#94a3b8;font-size:14px;">Your password has been changed successfully. Here are your account login details:</p>

            <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;width:150px;">Employee Code (EMP-no)</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:1px;">${user.employeeCode || ''}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;">Email Address</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;">${user.email}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;">New Password</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:2px;">${newPassword}</td>
                </tr>
              </table>
            </div>

            <p style="color:#ef4444;font-size:12px;margin:0;border-top:1px solid #334155;padding-top:16px;">
              ⚠️ If you did not make this change, please contact your administrator immediately.
            </p>
          </div>
        </div>
      `,
    }).catch(() => {});

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Send password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    const resetToken  = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl    = `${frontendUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: '🔑 Password Reset Request — Employee Tracker',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;">
            <h1 style="margin:0;font-size:22px;color:#fff;">Reset Your Password</h1>
          </div>
          <div style="padding:32px;">
            <p>Hi <strong>${user.name}</strong>,</p>
            <p style="color:#94a3b8;">We received a request to reset your password. Click the button below to set a new password.</p>
            <p style="color:#f59e0b;font-size:13px;">⏰ This link expires in <strong>20 minutes</strong>.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
                🔑 Reset Password
              </a>
            </div>
            <p style="color:#64748b;font-size:12px;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
            <p style="color:#64748b;font-size:12px;word-break:break-all;">Or copy this link: ${resetUrl}</p>
          </div>
        </div>
      `,
    });

    res.json({ message: 'If this email is registered, a reset link has been sent.' });
  } catch (error) {
    // Clean up token on failure
    try {
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        user.resetPasswordToken  = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
      }
    } catch (_) {}
    res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Reset password via token
// @route   POST /api/auth/reset-password/:token
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Both password fields are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Hash the raw token from URL to compare with DB
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken:  hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    user.password            = newPassword;
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Confirmation email
    await sendEmail({
      to: user.email,
      subject: '🔑 Your Password Has Been Reset Successfully',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 32px 24px;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff;">Password Reset Successful</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Employee Tracker Account Recovery</p>
          </div>
          <div style="padding:32px;">
            <p>Hi <strong>${user.name}</strong>,</p>
            <p style="color:#94a3b8;font-size:14px;">Your account password has been reset successfully using the forgot-password flow. Here are your credentials:</p>

            <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;width:150px;">Employee Code (EMP-no)</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:1px;">${user.employeeCode || ''}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;">Email Address</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;">${user.email}</td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:13px;padding:8px 0;">New Password</td>
                  <td style="color:#e2e8f0;font-weight:600;font-size:14px;padding:8px 0;font-family:monospace;letter-spacing:2px;">${newPassword}</td>
                </tr>
              </table>
            </div>

            <p style="color:#ef4444;font-size:12px;margin:0;border-top:1px solid #334155;padding-top:16px;">
              ⚠️ If you did not request this change, please contact your administrator immediately.
            </p>
          </div>
        </div>
      `,
    }).catch(() => {});

    res.json({ message: 'Password reset successful! You can now log in with your new password.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all employees — Admin/HR
// @route   GET /api/auth/employees
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────────────────────────────────────
const getAllEmployees = async (req, res) => {
  try {
    const isAdminRoles = ['Admin', 'HR', 'Payroll Manager', 'Accounts Payable (AP) Specialist', 'Chief Financial Officer (CFO)', 'CTO', 'COO', 'CEO'];
    
    if (isAdminRoles.includes(req.user.role)) {
      const employees = await User.find({})
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .sort({ createdAt: -1 });
      return res.json(employees);
    } else {
      const employees = await User.find({})
        .select('_id name email role designation profilePicture employeeCode department')
        .sort({ createdAt: -1 });
      return res.json(employees);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update employee (Admin only)
// @route   PUT /api/auth/employees/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const updateEmployee = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Employee not found' });

    const {
      name, email, role, designation, department,
      basicSalary, employeeCode, phone, alternatePhone,
      permanentAddress, currentAddress, bankDetails, joiningDate, password,
      weeklyHolidays, holidayStartDate, holidayValidUntil,
    } = req.body;

    if (employeeCode && employeeCode !== user.employeeCode) {
      const codeExists = await User.findOne({ employeeCode, _id: { $ne: user._id } });
      if (codeExists) {
        return res.status(400).json({ message: `Employee code "${employeeCode}" is already taken` });
      }
    }

    user.name         = name         || user.name;
    user.email        = email        || user.email;
    user.role         = role         || user.role;
    user.designation  = designation  !== undefined ? designation  : user.designation;
    user.department   = department   !== undefined ? department   : user.department;
    user.basicSalary  = basicSalary  !== undefined ? basicSalary  : user.basicSalary;
    user.employeeCode = employeeCode !== undefined ? employeeCode : user.employeeCode;
    user.phone        = phone        !== undefined ? phone        : user.phone;
    user.alternatePhone = alternatePhone !== undefined ? alternatePhone : user.alternatePhone;
    user.permanentAddress = permanentAddress !== undefined ? permanentAddress : user.permanentAddress;
    user.currentAddress = currentAddress !== undefined ? currentAddress : user.currentAddress;

    if (bankDetails !== undefined) {
      user.bankDetails = {
        bankName:          bankDetails.bankName          !== undefined ? bankDetails.bankName          : (user.bankDetails?.bankName          || ''),
        branchName:        bankDetails.branchName        !== undefined ? bankDetails.branchName        : (user.bankDetails?.branchName        || ''),
        ifscCode:          bankDetails.ifscCode          !== undefined ? bankDetails.ifscCode          : (user.bankDetails?.ifscCode          || ''),
        bankAddress:       bankDetails.bankAddress       !== undefined ? bankDetails.bankAddress       : (user.bankDetails?.bankAddress       || ''),
        accountHolderName: bankDetails.accountHolderName !== undefined ? bankDetails.accountHolderName : (user.bankDetails?.accountHolderName || ''),
        accountNumber:     bankDetails.accountNumber     !== undefined ? bankDetails.accountNumber     : (user.bankDetails?.accountNumber     || ''),
      };
    }

    if (joiningDate) user.joiningDate = joiningDate;
    if (password && password.length >= 6) user.password = password;
    
    if (weeklyHolidays !== undefined) {
      if (user.holidayStartDate && user.holidayValidUntil && user.weeklyHolidays.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentStart = new Date(user.holidayStartDate);
        currentStart.setHours(0, 0, 0, 0);
        
        const validUntil = new Date(user.holidayValidUntil);
        validUntil.setHours(23, 59, 59, 999);
        
        if (today <= validUntil) {
          const startLockDate = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
          const isStartLocked = today >= startLockDate;
          const isSameStart = holidayStartDate && new Date(holidayStartDate).getTime() === user.holidayStartDate.getTime();
          
          if (isStartLocked && !isSameStart) {
            return res.status(400).json({ message: "Cannot change the holiday start date once the week is about to begin or active." });
          }
          
          const oldSet = new Set(user.weeklyHolidays);
          const newSet = new Set(weeklyHolidays);
          const changedDays = [];
          for (let i = 0; i < 7; i++) {
             if (oldSet.has(i) !== newSet.has(i)) changedDays.push(i);
          }
          
          for (let dayIdx of changedDays) {
            const daysToAdd = (dayIdx - currentStart.getDay() + 7) % 7;
            const targetDate = new Date(currentStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            const lockDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
            if (today >= lockDate) {
              return res.status(400).json({ message: `Cannot change the holiday for ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayIdx]} less than 1 day before it occurs.` });
            }
          }
        }
      }

      user.weeklyHolidays = weeklyHolidays;
      if (weeklyHolidays.length > 0 && holidayStartDate) {
        user.holidayStartDate = new Date(holidayStartDate);
        if (holidayValidUntil) {
          user.holidayValidUntil = new Date(holidayValidUntil);
        } else {
          // Fallback if not explicitly provided
          user.holidayValidUntil = new Date(user.holidayStartDate.getTime() + 6 * 24 * 60 * 60 * 1000); 
        }
      } else if (weeklyHolidays.length === 0) {
        user.holidayStartDate = null;
        user.holidayValidUntil = null;
      }
    }

    const updated = await user.save();
    
    // If weeklyHolidays were updated, notify admins/HR
    if (weeklyHolidays !== undefined && weeklyHolidays.length > 0) {
      const adminsAndHR = await User.find({ role: { $in: ['Admin', 'HR'] } }).select('_id');
      const notifications = adminsAndHR.map(admin => ({
        userId: admin._id,
        title: 'Holidays Set',
        message: `Weekly holidays have been successfully set for ${updated.name}. They will be valid for 1 week.`,
        type: 'info',
        link: '/admin/holidays'
      }));
      if (notifications.length > 0) {
        // Require inside to avoid circular dependency issues at the top
        const Notification = require('../models/Notification');
        await Notification.insertMany(notifications).catch(() => {});
      }
    }

    res.json(userResponse(updated));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete employee (Admin only)
// @route   DELETE /api/auth/employees/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const deleteEmployee = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Employee not found' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload profile picture
// @route   POST /api/auth/upload-avatar
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided' });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.profilePicture) {
      const fs = require('fs'), path = require('path');
      const oldPath = path.join(__dirname, '../uploads/avatars', user.profilePicture);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.profilePicture = req.file.filename;
    await user.save();
    res.json({
      message: 'Profile picture updated successfully',
      profilePicture:    req.file.filename,
      profilePictureUrl: `/uploads/avatars/${req.file.filename}`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete profile picture
// @route   DELETE /api/auth/delete-avatar
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.profilePicture) {
      const fs = require('fs'), path = require('path');
      const filePath = path.join(__dirname, '../uploads/avatars', user.profilePicture);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      user.profilePicture = '';
      await user.save();
    }
    res.json({ message: 'Profile picture removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// @desc    Check if provided password matches current user password (used by UI validation)
// @route   POST /api/auth/check-password
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const checkCurrentPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.json({ valid: false });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.matchPassword(currentPassword);
    res.json({ valid: isMatch });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Check if today is the logged-in user's birthday
// @route   GET /api/auth/birthday-check
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const checkBirthday = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('name dateOfBirth');
    if (!user || !user.dateOfBirth) {
      return res.json({ isBirthday: false });
    }

    const today = new Date();
    const dob = new Date(user.dateOfBirth);

    const isToday =
      today.getDate() === dob.getDate() &&
      today.getMonth() === dob.getMonth();

    res.json({
      isBirthday: isToday,
      name: user.name,
      dateOfBirth: user.dateOfBirth,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// @desc    Save face descriptor for user
// @route   POST /api/auth/save-face
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const saveFaceDescriptor = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    
    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ message: 'Invalid face descriptor. Must be a 128-dimensional array.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.faceDescriptor = faceDescriptor;
    user.faceResetRequest = 'None';
    await user.save();

    res.json({ message: 'Face descriptor saved successfully', faceDescriptor: user.faceDescriptor, faceResetRequest: user.faceResetRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Request to reset face authentication
// @route   POST /api/auth/request-face-reset
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const requestFaceReset = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.faceResetRequest = 'Pending';
    await user.save();
    res.json({ message: 'Face reset request sent successfully.', faceResetRequest: 'Pending' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Approve or reject face reset request
// @route   PUT /api/auth/approve-face-reset/:id
// @access  Private (Admin, HR, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const reviewFaceReset = async (req, res) => {
  try {
    const { status } = req.body; // 'Approved' or 'Rejected'
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.faceResetRequest = status;
    if (status === 'Approved') {
      user.faceDescriptor = []; // Clear current face immediately
    }
    await user.save();

    // Log to audit history
    if (status === 'Approved' || status === 'Rejected') {
      await FaceResetLog.create({
        employee: user._id,
        employeeName: user.name || 'Employee',
        employeeCode: user.employeeCode || '',
        status,
        reviewedBy: req.user._id,
        reviewerName: req.user.name || 'Admin',
        reviewerRole: req.user.role || 'Admin',
        reviewerEmployeeCode: req.user.employeeCode || '',
        reviewedAt: new Date(),
      });
    }

    res.json({ message: `Face reset request ${status.toLowerCase()}.` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get face reset history & stats
// @route   GET /api/auth/face-resets/history
// @access  Private (Admin, HR)
// ─────────────────────────────────────────────────────────────────────────────
const getFaceResetHistory = async (req, res) => {
  try {
    const history = await FaceResetLog.find()
      .populate('employee', 'name employeeCode profilePicture designation')
      .populate('reviewedBy', 'name role employeeCode')
      .sort({ reviewedAt: -1, createdAt: -1 });

    const approved = await FaceResetLog.countDocuments({ status: 'Approved' });
    const rejected = await FaceResetLog.countDocuments({ status: 'Rejected' });

    res.json({
      history,
      stats: {
        approved,
        rejected,
        total: history.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  getMyFullProfile,
  updateMyProfile,
  changePassword,
  checkCurrentPassword,
  checkBirthday,
  forgotPassword,
  resetPassword,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
  uploadAvatar,
  deleteAvatar,
  saveFaceDescriptor,
  requestFaceReset,
  reviewFaceReset,
  getFaceResetHistory,
};



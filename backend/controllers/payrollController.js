const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const { getTenantId, getTenantUserFilter, belongsToTenant } = require('../utils/tenantHelper');

// ── Helper: get the number of calendar days in a month ──────────────
const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();

/**
 * Computes exact deduction breakdown and net salary based on 5 enterprise rules:
 * Rule 1: Monthly inactive count >= 155 -> 1% net salary deduction
 * Rule 2: Yearly unapproved absences >= 5 -> 1% net salary deduction
 * Rule 3: Post-absence leave applied and approved -> 0.5% net salary deduction (per occurrence)
 * Rule 4: Post-absence leave applied and rejected -> 1% net salary deduction (per occurrence)
 * Rule 5: Emergency leave can only be applied post-absence, and has 0% deduction penalty (Exempt)
 */
const computeSalaryDeductions = async ({
  emp,
  month,
  year,
  proratedSalary,
  pfDeduction,
  mediclaimDeduction,
  bonus,
}) => {
  const monthStr = month.toString().padStart(2, '0');
  const yearStr  = year.toString();

  // Baseline standard net salary before disciplinary / attendance deductions
  const standardNetSalary = Math.max(0, proratedSalary - (pfDeduction + mediclaimDeduction) + (bonus || 0));

  const breakdownNotes = [];

  // ── Rule 1: Inactive Count Check (Month-wide) ─────────────────────
  const monthAttendanceRecords = await Attendance.find({
    employeeId: emp._id,
    date: { $regex: `^${yearStr}-${monthStr}` },
  }).select('date inactiveCount status').lean();

  const monthlyInactiveCount = monthAttendanceRecords.reduce((sum, r) => sum + (r.inactiveCount || 0), 0);
  let inactiveDeduction = 0;
  if (monthlyInactiveCount >= 155) {
    inactiveDeduction = Math.round(standardNetSalary * 0.01);
    breakdownNotes.push(`Inactive Count Penalty (>=155): ${monthlyInactiveCount} occurrences in month -> 1% deducted (-₹${inactiveDeduction.toLocaleString()})`);
  }

  // ── Rule 2: Yearly Unapproved Absences (Year-to-date up to this payroll) ─
  const yearStart = new Date(year, 0, 1);
  const joiningDate = new Date(emp.joiningDate || yearStart);
  const trackStart = joiningDate > yearStart ? new Date(joiningDate) : new Date(yearStart);
  trackStart.setHours(0, 0, 0, 0);

  const payrollMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const now = new Date();
  const trackEnd = payrollMonthEnd < now ? payrollMonthEnd : now;

  const yearAttendance = await Attendance.find({
    employeeId: emp._id,
    date: { $regex: `^${yearStr}` },
  }).select('date status').lean();

  const attendanceMap = {};
  yearAttendance.forEach(a => { attendanceMap[a.date] = a.status; });

  const approvedLeaves = await Leave.find({
    employeeId: emp._id,
    status: 'Approved',
    startDate: { $lte: payrollMonthEnd },
    endDate:   { $gte: yearStart },
  }).lean();

  const empWeeklyHolidays = Array.isArray(emp.weeklyHolidays) ? emp.weeklyHolidays : [];

  let yearlyUnapprovedAbsences = 0;
  const cursorDate = new Date(trackStart);

  while (cursorDate <= trackEnd) {
    const dayOfWeek = cursorDate.getDay();
    const curDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(cursorDate);

    const isHoliday = empWeeklyHolidays.includes(dayOfWeek);

    const isCoveredByApprovedLeave = approvedLeaves.some(l => {
      const lStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.startDate));
      const lEnd   = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.endDate));
      return curDateStr >= lStart && curDateStr <= lEnd;
    });

    if (!isHoliday && !isCoveredByApprovedLeave) {
      const attStatus = attendanceMap[curDateStr];
      if (attStatus === 'Absent' || !attStatus) {
        yearlyUnapprovedAbsences++;
      }
    }

    cursorDate.setDate(cursorDate.getDate() + 1);
  }

  let unapprovedAbsenceDeduction = 0;
  if (yearlyUnapprovedAbsences >= 5) {
    unapprovedAbsenceDeduction = Math.round(standardNetSalary * 0.01);
    breakdownNotes.push(`Unapproved Absenteeism Penalty (>=5/year): ${yearlyUnapprovedAbsences} unapproved absent days in year -> 1% deducted (-₹${unapprovedAbsenceDeduction.toLocaleString()})`);
  }

  // ── Rule 3, 4, 5: Post-Absence Leaves in this Month ────────────────
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0, 23, 59, 59, 999);

  const monthLeaves = await Leave.find({
    employeeId: emp._id,
    startDate: { $gte: monthStart, $lte: monthEnd },
  }).lean();

  let postAbsenceApprovedLeaves = 0;
  let postAbsenceRejectedLeaves = 0;
  let emergencyLeaveExemptCount = 0;

  monthLeaves.forEach(l => {
    // Rule 5: Emergency leaves can only be applied after taking leave and are 100% EXEMPT from deduction penalties
    if (l.leaveType === 'Emergency') {
      emergencyLeaveExemptCount++;
      return;
    }

    // For non-emergency (e.g. Casual) leaves, check if applied post-absence
    const lStartStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.startDate));
    const lCreatedStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(l.createdAt || l.startDate));
    const isPostAbsence = l.appliedAfterAbsence || (lCreatedStr >= lStartStr);

    if (isPostAbsence) {
      if (l.status === 'Approved') {
        postAbsenceApprovedLeaves++;
      } else if (l.status === 'Rejected') {
        postAbsenceRejectedLeaves++;
      }
    }
  });

  const postAbsenceApprovedDeduction = postAbsenceApprovedLeaves > 0
    ? Math.round(standardNetSalary * 0.005 * postAbsenceApprovedLeaves)
    : 0;
  if (postAbsenceApprovedLeaves > 0) {
    breakdownNotes.push(`Post-absence Approved Leave Penalty: ${postAbsenceApprovedLeaves} occurrence(s) -> 0.5% deducted (-₹${postAbsenceApprovedDeduction.toLocaleString()})`);
  }

  const postAbsenceRejectedDeduction = postAbsenceRejectedLeaves > 0
    ? Math.round(standardNetSalary * 0.01 * postAbsenceRejectedLeaves)
    : 0;
  if (postAbsenceRejectedLeaves > 0) {
    breakdownNotes.push(`Post-absence Rejected Leave Penalty: ${postAbsenceRejectedLeaves} occurrence(s) -> 1% deducted (-₹${postAbsenceRejectedDeduction.toLocaleString()})`);
  }

  if (emergencyLeaveExemptCount > 0) {
    breakdownNotes.push(`Emergency Leave: ${emergencyLeaveExemptCount} taken post-absence as permitted (0% penalty - Exempt)`);
  }

  const penaltyDeductions = inactiveDeduction + unapprovedAbsenceDeduction + postAbsenceApprovedDeduction + postAbsenceRejectedDeduction;
  const leaveDeduction = penaltyDeductions;
  const totalDeductions = pfDeduction + mediclaimDeduction + leaveDeduction;
  const netSalary = Math.max(0, standardNetSalary - penaltyDeductions);

  return {
    inactiveCount: monthlyInactiveCount,
    inactiveDeduction,
    yearlyUnapprovedAbsences,
    unapprovedAbsenceDeduction,
    postAbsenceApprovedLeaves,
    postAbsenceApprovedDeduction,
    postAbsenceRejectedLeaves,
    postAbsenceRejectedDeduction,
    penaltyDeductions,
    leaveDeduction,
    totalDeductions,
    netSalary,
    breakdownNotes,
  };
};

/**
 * Computes exact payroll record for a single employee, updates accumulated PF/Mediclaim,
 * triggers in-app notification, and dispatches detailed fund deduction email.
 */
const processEmployeePayrollRecord = async ({
  emp,
  month,
  year,
  monthYear,
  totalDaysInMonth,
  bonusOverride = null,
  bonusReasonOverride = null,
  isAutoCron = false,
}) => {
  const basicSalary = emp.basicSalary || 0;

  // Prorate for mid-month joiners
  const joiningDate  = new Date(emp.joiningDate || Date.now());
  const monthStart   = new Date(year, month - 1, 1);

  let effectiveDays = totalDaysInMonth;
  if (joiningDate > monthStart) {
    effectiveDays = totalDaysInMonth - joiningDate.getDate() + 1;
  }

  const proratedSalary = Math.round((basicSalary / totalDaysInMonth) * effectiveDays);

  const rawPf        = emp.pfAmount || 0;
  const rawMediclaim = emp.mediclaimAmount || 0;

  const pfDeduction        = Math.round((rawPf / totalDaysInMonth) * effectiveDays);
  const mediclaimDeduction = Math.round((rawMediclaim / totalDaysInMonth) * effectiveDays);

  const existingPayroll = await Payroll.findOne({
    employeeId: emp._id,
    monthYear,
  });

  const bonus = bonusOverride !== null
    ? bonusOverride
    : (existingPayroll ? (existingPayroll.bonus || 0) : 0);
  const bonusReason = bonusReasonOverride !== null
    ? bonusReasonOverride
    : (existingPayroll ? (existingPayroll.bonusReason || '') : '');

  const calculation = await computeSalaryDeductions({
    emp,
    month,
    year,
    proratedSalary,
    pfDeduction,
    mediclaimDeduction,
    bonus,
  });

  const {
    inactiveCount,
    inactiveDeduction,
    yearlyUnapprovedAbsences,
    unapprovedAbsenceDeduction,
    postAbsenceApprovedLeaves,
    postAbsenceApprovedDeduction,
    postAbsenceRejectedLeaves,
    postAbsenceRejectedDeduction,
    penaltyDeductions,
    leaveDeduction,
    totalDeductions,
    netSalary,
    breakdownNotes,
  } = calculation;

  let prevPf = 0;
  let prevMediclaim = 0;
  let payroll;
  let isNew = false;

  if (existingPayroll) {
    prevPf        = existingPayroll.pfDeduction || 0;
    prevMediclaim = existingPayroll.mediclaimDeduction || 0;

    existingPayroll.baseSalary                  = proratedSalary;
    existingPayroll.bonus                       = bonus;
    existingPayroll.bonusReason                 = bonusReason;
    existingPayroll.pfDeduction                 = pfDeduction;
    existingPayroll.mediclaimDeduction           = mediclaimDeduction;
    existingPayroll.leaveDeduction              = leaveDeduction;
    existingPayroll.inactiveCount               = inactiveCount;
    existingPayroll.inactiveDeduction           = inactiveDeduction;
    existingPayroll.yearlyUnapprovedAbsences    = yearlyUnapprovedAbsences;
    existingPayroll.unapprovedAbsenceDeduction  = unapprovedAbsenceDeduction;
    existingPayroll.postAbsenceApprovedLeaves   = postAbsenceApprovedLeaves;
    existingPayroll.postAbsenceApprovedDeduction = postAbsenceApprovedDeduction;
    existingPayroll.postAbsenceRejectedLeaves   = postAbsenceRejectedLeaves;
    existingPayroll.postAbsenceRejectedDeduction = postAbsenceRejectedDeduction;
    existingPayroll.penaltyDeductions           = penaltyDeductions;
    existingPayroll.deductionBreakdownNotes     = breakdownNotes;
    existingPayroll.deductions                  = totalDeductions;
    existingPayroll.netSalary                   = netSalary;
    existingPayroll.totalDaysInMonth            = totalDaysInMonth;
    existingPayroll.effectiveDays               = effectiveDays;
    payroll = await existingPayroll.save();
  } else {
    isNew = true;
    payroll = await Payroll.create({
      companyId: getTenantId(emp),
      employeeId: emp._id,
      monthYear,
      baseSalary: proratedSalary,
      bonus,
      bonusReason,
      pfDeduction,
      mediclaimDeduction,
      leaveDeduction,
      inactiveCount,
      inactiveDeduction,
      yearlyUnapprovedAbsences,
      unapprovedAbsenceDeduction,
      postAbsenceApprovedLeaves,
      postAbsenceApprovedDeduction,
      postAbsenceRejectedLeaves,
      postAbsenceRejectedDeduction,
      penaltyDeductions,
      deductionBreakdownNotes: breakdownNotes,
      deductions: totalDeductions,
      netSalary,
      totalDaysInMonth,
      effectiveDays,
      status: 'Unpaid',
    });
  }

  // Accumulate PF & Mediclaim on User (delta-safe for re-generation)
  const pfDelta        = pfDeduction - prevPf;
  const mediclaimDelta = mediclaimDeduction - prevMediclaim;

  if (pfDelta !== 0 || mediclaimDelta !== 0) {
    await User.findByIdAndUpdate(emp._id, {
      $inc: {
        totalPfAccumulated:        pfDelta,
        totalMediclaimAccumulated: mediclaimDelta,
      },
    });
  }

  // Fetch updated user to display exact accumulated balances in email & response
  const freshUser = await User.findById(emp._id).select('totalPfAccumulated totalMediclaimAccumulated pfId mediclaimId');
  const totalPf = freshUser ? freshUser.totalPfAccumulated : ((emp.totalPfAccumulated || 0) + pfDelta);
  const totalMediclaim = freshUser ? freshUser.totalMediclaimAccumulated : ((emp.totalMediclaimAccumulated || 0) + mediclaimDelta);
  const pfId = (freshUser && freshUser.pfId) || emp.pfId || 'Assigned';
  const mediclaimId = (freshUser && freshUser.mediclaimId) || emp.mediclaimId || 'Assigned';

  // In-app Notification for employee
  Notification.create({
    companyId: getTenantId(emp),
    userId: emp._id,
    type: 'payroll_generated',
    title: isAutoCron ? 'Monthly Salary & Fund Deductions Processed' : 'Payslip Updated',
    message: `Your salary for ${monthYear} has been generated: PF ₹${pfDeduction.toLocaleString()} & Mediclaim ₹${mediclaimDeduction.toLocaleString()} deducted. Net Salary: ₹${netSalary.toLocaleString()}.`,
    link: '/employee/payslips',
  }).catch(err => console.error('Payroll Notif Error:', err));

  // Mask bank account for privacy
  const rawAcct = emp.bankDetails?.accountNumber || '';
  const maskedAcct = rawAcct.length > 4 ? `•••• •••• ${rawAcct.slice(-4)}` : (rawAcct || 'On File');

  // Send rich HTML Email detailing PF & Mediclaim deductions and fund balances
  sendEmail({
    to: emp.email,
    subject: `Salary Statement & Statutory Deductions (PF & Mediclaim) - ${monthYear}`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:650px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <div style="background:linear-gradient(135deg,#312e81 0%,#4338ca 50%,#6366f1 100%);padding:32px 28px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Monthly Salary &amp; Fund Deductions Advice</h1>
          <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;font-weight:500;">Pay Period: ${monthYear} ${isAutoCron ? '• (Automated Monthly Run)' : ''}</p>
        </div>

        <div style="padding:28px 24px;">
          <p style="color:#cbd5e1;font-size:14px;line-height:1.7;margin:0 0 20px;">
            Dear <strong>${emp.name}</strong> (${emp.employeeCode || 'EMP'}),<br/>
            Your monthly salary for <strong>${monthYear}</strong> has been processed. In accordance with company policy, your statutory deductions for <strong>Provident Fund (PF)</strong> and <strong>Mediclaim Health Insurance</strong> have been deducted and credited to your accumulated corporate fund accounts.
          </p>

          <!-- Fund Accumulation Highlights -->
          <div style="display:flex;gap:12px;margin-bottom:24px;">
            <div style="flex:1;background:#1e293b;border:1px solid #3b82f6;border-radius:12px;padding:16px;text-align:center;">
              <span style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:1px;display:block;">Provident Fund (PF)</span>
              <span style="font-size:20px;font-weight:800;color:#ffffff;display:block;margin:6px 0 2px;">- ₹${pfDeduction.toLocaleString()}</span>
              <span style="font-size:11px;color:#94a3b8;display:block;">PF ID: <strong>${pfId}</strong></span>
              <span style="font-size:12px;color:#60a5fa;display:block;margin-top:4px;font-weight:600;">Total Accumulated: ₹${totalPf.toLocaleString()}</span>
            </div>
            <div style="flex:1;background:#1e293b;border:1px solid #10b981;border-radius:12px;padding:16px;text-align:center;">
              <span style="font-size:11px;font-weight:700;color:#6ee7b7;text-transform:uppercase;letter-spacing:1px;display:block;">Mediclaim Health Fund</span>
              <span style="font-size:20px;font-weight:800;color:#ffffff;display:block;margin:6px 0 2px;">- ₹${mediclaimDeduction.toLocaleString()}</span>
              <span style="font-size:11px;color:#94a3b8;display:block;">Mediclaim ID: <strong>${mediclaimId}</strong></span>
              <span style="font-size:12px;color:#34d399;display:block;margin-top:4px;font-weight:600;">Total Accumulated: ₹${totalMediclaim.toLocaleString()}</span>
            </div>
          </div>

          <!-- Salary Statement Table -->
          <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:18px;margin-bottom:24px;">
            <h3 style="margin:0 0 14px;font-size:14px;color:#f8fafc;font-weight:700;border-bottom:1px solid #334155;padding-bottom:8px;">
              Salary Breakdown &amp; Deductions Summary
            </h3>
            <table style="width:100%;font-size:13px;border-collapse:collapse;color:#cbd5e1;">
              <tr>
                <td style="padding:6px 0;">Base Salary ${effectiveDays < totalDaysInMonth ? `(Prorated ${effectiveDays}/${totalDaysInMonth} days)` : ''}:</td>
                <td style="padding:6px 0;font-weight:600;color:#f1f5f9;text-align:right;">₹${proratedSalary.toLocaleString()}</td>
              </tr>
              ${bonus > 0 ? `
              <tr>
                <td style="padding:6px 0;color:#34d399;">Special Bonus ${bonusReason ? `(${bonusReason})` : ''}:</td>
                <td style="padding:6px 0;font-weight:bold;color:#34d399;text-align:right;">+ ₹${bonus.toLocaleString()}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding:6px 0;color:#f87171;">Provident Fund (PF - 12%):</td>
                <td style="padding:6px 0;font-weight:600;color:#f87171;text-align:right;">- ₹${pfDeduction.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#f87171;">Mediclaim Health Contribution:</td>
                <td style="padding:6px 0;font-weight:600;color:#f87171;text-align:right;">- ₹${mediclaimDeduction.toLocaleString()}</td>
              </tr>
              ${penaltyDeductions > 0 ? `
              <tr>
                <td style="padding:6px 0;color:#fbbf24;">Disciplinary &amp; Leave Penalties:</td>
                <td style="padding:6px 0;font-weight:600;color:#fbbf24;text-align:right;">- ₹${penaltyDeductions.toLocaleString()}</td>
              </tr>
              ` : ''}
              <tr style="border-top:1px solid #334155;">
                <td style="padding:8px 0;font-weight:700;color:#ef4444;">Total Deductions:</td>
                <td style="padding:8px 0;font-weight:bold;color:#ef4444;text-align:right;">- ₹${totalDeductions.toLocaleString()}</td>
              </tr>
              <tr style="border-top:2px solid #3b82f6;background:rgba(59,130,246,0.08);">
                <td style="padding:10px 8px;font-size:15px;font-weight:bold;color:#ffffff;">Net Take-Home Salary:</td>
                <td style="padding:10px 8px;font-size:16px;font-weight:800;color:#38bdf8;text-align:right;">₹${netSalary.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- Bank Transfer Advice Note -->
          <div style="background:#0b1329;border:1px solid #1e3a8a;border-radius:10px;padding:14px;margin-bottom:20px;font-size:12px;color:#93c5fd;">
            <strong>Bank Transfer Disbursement:</strong><br/>
            Bank: <strong>${emp.bankDetails?.bankName || 'Registered Bank'}</strong> | A/C: <strong>${maskedAcct}</strong> | IFSC: <strong>${emp.bankDetails?.ifscCode || 'On File'}</strong><br/>
            This Net Salary amount is scheduled for direct transfer to your bank account by the Finance Department.
          </div>

          ${breakdownNotes.length > 0 ? `
            <div style="margin-top:12px;padding:12px;background:#1e293b;border:1px solid #334155;border-radius:8px;font-size:12px;color:#94a3b8;">
              <strong style="color:#e2e8f0;">Salary Calculation Notes:</strong>
              <ul style="margin:6px 0 0;padding-left:18px;">
                ${breakdownNotes.map(n => `<li>${n}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div style="background:#090d16;padding:16px;text-align:center;border-top:1px solid #1e293b;">
          <p style="margin:0;font-size:11px;color:#64748b;">&copy; 2026 Employee Tracker Enterprise. All Rights Reserved. This is an automated corporate notification.</p>
        </div>
      </div>
    `,
  }).catch(err => console.error('Payroll Email Error:', err));

  return { payroll, isNew };
};

// @desc    Generate payroll (Bulk or Single Employee) for a given month
// @route   POST /api/payroll/generate
// @access  Private (Admin, HR)
const generatePayroll = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { monthYear, employeeId } = req.body; // MM-YYYY, optional employeeId

    if (!monthYear) {
      return res.status(400).json({ message: 'monthYear is required (MM-YYYY)' });
    }

    const [monthStr, yearStr] = monthYear.split('-');
    const month = parseInt(monthStr, 10);
    const year  = parseInt(yearStr, 10);

    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid monthYear format. Use MM-YYYY' });
    }

    const totalDaysInMonth = getDaysInMonth(month, year);
    const lastDayOfMonth   = new Date(year, month, 0, 23, 59, 59, 999);
    const ADMIN_ROLES      = ['Admin', 'SuperAdmin'];

    // ── CASE A: Single Employee Manual Generation (Tenant-Isolated) ──
    if (employeeId) {
      const emp = await User.findOne({
        ...getTenantUserFilter(tenantId),
        _id: employeeId,
        role: { $nin: ADMIN_ROLES },
        basicSalary: { $gt: 0 },
        joiningDate: { $lte: lastDayOfMonth },
      });

      if (!emp) {
        return res.status(404).json({
          message: 'Employee not found in your organization or not eligible for payroll in this month (check basic salary and joining date).',
        });
      }

      const { payroll, isNew } = await processEmployeePayrollRecord({
        emp,
        month,
        year,
        monthYear,
        totalDaysInMonth,
        isAutoCron: false,
      });

      return res.status(200).json({
        message: `Payslip for ${emp.name} ${isNew ? 'generated' : 'updated'} successfully!`,
        payroll,
        status: isNew ? 'Generated' : 'Updated',
      });
    }

    // ── CASE B: Bulk Generation Strictly for This Company Tenant ─────
    const employees = await User.find({
      ...getTenantUserFilter(tenantId),
      role: { $nin: ADMIN_ROLES },
      basicSalary: { $gt: 0 },
      joiningDate: { $lte: lastDayOfMonth },
    });

    if (employees.length === 0) {
      return res.status(400).json({ message: 'No eligible employees found in your organization for this month' });
    }

    const payrollResults = [];

    for (const emp of employees) {
      try {
        const { payroll, isNew } = await processEmployeePayrollRecord({
          emp,
          month,
          year,
          monthYear,
          totalDaysInMonth,
          isAutoCron: false,
        });
        payrollResults.push({ employee: emp.name, status: isNew ? 'Generated' : 'Updated', payroll });
      } catch (err) {
        console.error(`Error processing payroll for ${emp.name}:`, err);
      }
    }

    res.status(201).json({
      message: `Payroll processed for ${payrollResults.length} employees`,
      results: payrollResults,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate payroll for a single employee
// @route   POST /api/payroll/generate-single
// @access  Private (Admin, HR)
const generateSinglePayroll = async (req, res) => {
  req.body.employeeId = req.body.employeeId || req.params.employeeId;
  return generatePayroll(req, res);
};

// @desc    Automated Payroll & Fund Deductions Runner (Cron runs across all; Admin manual trigger scopes to tenantId)
const runAutoPayrollJob = async (customMonthYear = null, tenantId = null) => {
  let targetMonthYear = customMonthYear;
  if (!targetMonthYear) {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const m = prevMonthDate.getMonth() + 1;
    const y = prevMonthDate.getFullYear();
    targetMonthYear = `${String(m).padStart(2, '0')}-${y}`;
  }

  const [monthStr, yearStr] = targetMonthYear.split('-');
  const month = parseInt(monthStr, 10);
  const year  = parseInt(yearStr, 10);
  const totalDaysInMonth = getDaysInMonth(month, year);
  const lastDayOfMonth   = new Date(year, month, 0, 23, 59, 59, 999);

  const ADMIN_ROLES = ['Admin', 'SuperAdmin'];
  const empFilter = tenantId
    ? {
        ...getTenantUserFilter(tenantId),
        role: { $nin: ADMIN_ROLES },
        basicSalary: { $gt: 0 },
        joiningDate: { $lte: lastDayOfMonth },
      }
    : {
        role: { $nin: ADMIN_ROLES },
        basicSalary: { $gt: 0 },
        joiningDate: { $lte: lastDayOfMonth },
      };

  const employees = await User.find(empFilter);

  console.log(`[Auto Payroll Runner] Starting automated payroll run for ${targetMonthYear} across ${employees.length} employees...`);

  const results = [];
  for (const emp of employees) {
    try {
      const { payroll, isNew } = await processEmployeePayrollRecord({
        emp,
        month,
        year,
        monthYear: targetMonthYear,
        totalDaysInMonth,
        isAutoCron: true,
      });
      results.push({ employee: emp.name, status: isNew ? 'Generated' : 'Updated', payroll });
      console.log(`[Auto Payroll Runner] ✅ ${emp.name} (${emp.employeeCode}) processed. Net: ₹${payroll.netSalary}`);
    } catch (err) {
      console.error(`[Auto Payroll Runner] ❌ Failed for ${emp.name}:`, err.message);
    }
  }

  console.log(`[Auto Payroll Runner] Finished run for ${targetMonthYear}. ${results.length} processed.`);
  return { targetMonthYear, count: results.length, results };
};

// @desc    Admin manual trigger for auto-payroll scheduler (strictly scoped to caller's organization)
// @route   POST /api/payroll/trigger-auto-job
// @access  Private (Admin)
const triggerAutoPayroll = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { monthYear } = req.body;
    const result = await runAutoPayrollJob(monthYear, tenantId);
    res.json({
      message: `Automated payroll job executed successfully for ${result.targetMonthYear}`,
      result,
    });
  } catch (error) {
    res.status(500).json({ message: 'Auto payroll execution failed', error: error.message });
  }
};

// @desc    Get my payslips
// @route   GET /api/payroll/my-slips
// @access  Private
const getMyPayslips = async (req, res) => {
  try {
    const payslips = await Payroll.find({ employeeId: req.user._id })
      .populate('employeeId', 'name email department designation employeeCode role pfId mediclaimId bankDetails')
      .sort({ createdAt: -1 });
    res.json(payslips);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all payroll records (Admin/HR — strictly tenant-isolated)
// @route   GET /api/payroll/all
// @access  Private (Admin, HR)
const getAllPayroll = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { monthYear } = req.query;
    const filter = { companyId: tenantId };
    if (monthYear) filter.monthYear = monthYear;

    const payrolls = await Payroll.find(filter)
      .populate('employeeId', 'name email department designation employeeCode role pfId mediclaimId bankDetails basicSalary pfAmount mediclaimAmount totalPfAccumulated totalMediclaimAccumulated phone')
      .sort({ createdAt: -1 });

    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update payroll status (Paid, Unpaid, Pending — tenant-isolated)
// @route   PUT /api/payroll/mark-paid/:id
// @access  Private (Admin, HR)
const markAsPaid = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { status } = req.body;
    const newStatus = status && ['Paid', 'Unpaid', 'Pending'].includes(status) ? status : 'Paid';

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll || !belongsToTenant(payroll, tenantId)) {
      return res.status(404).json({ message: 'Payroll record not found in your organization' });
    }

    payroll.status = newStatus;
    await payroll.save();

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate / Award bonus to an employee (tenant-isolated)
// @route   POST /api/payroll/generate-bonus
// @access  Private (Admin, HR)
const generateBonus = async (req, res) => {
  try {
    const tenantId = req.tenantId || getTenantId(req.user);
    const { employeeId, amount, monthYear, reason } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required.' });
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid bonus amount greater than 0.' });
    }

    const emp = await User.findById(employeeId);
    if (!emp || !belongsToTenant(emp, tenantId)) {
      return res.status(404).json({ message: 'Employee not found in your organization.' });
    }

    // Default to current month-year (MM-YYYY) if not specified
    let targetMonthYear = monthYear;
    if (!targetMonthYear) {
      const now = new Date();
      targetMonthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    }

    const [monthStr, yearStr] = targetMonthYear.split('-');
    const m = parseInt(monthStr, 10);
    const y = parseInt(yearStr, 10);

    if (!m || !y || m < 1 || m > 12) {
      return res.status(400).json({ message: 'Invalid monthYear format. Use MM-YYYY' });
    }

    const totalDaysInMonth = getDaysInMonth(m, y);

    // Check if payroll record already exists for this employee and month
    let payroll = await Payroll.findOne({
      employeeId: emp._id,
      monthYear: targetMonthYear,
      type: 'Regular',
    });

    if (payroll) {
      // Add or update bonus
      const totalBonus = (payroll.bonus || 0) + numAmount;
      const calculation = await computeSalaryDeductions({
        emp,
        month: m,
        year: y,
        proratedSalary: payroll.baseSalary,
        pfDeduction: payroll.pfDeduction,
        mediclaimDeduction: payroll.mediclaimDeduction,
        bonus: totalBonus,
      });

      payroll.bonus = totalBonus;
      if (reason) payroll.bonusReason = reason;
      payroll.inactiveCount = calculation.inactiveCount;
      payroll.inactiveDeduction = calculation.inactiveDeduction;
      payroll.yearlyUnapprovedAbsences = calculation.yearlyUnapprovedAbsences;
      payroll.unapprovedAbsenceDeduction = calculation.unapprovedAbsenceDeduction;
      payroll.postAbsenceApprovedLeaves = calculation.postAbsenceApprovedLeaves;
      payroll.postAbsenceApprovedDeduction = calculation.postAbsenceApprovedDeduction;
      payroll.postAbsenceRejectedLeaves = calculation.postAbsenceRejectedLeaves;
      payroll.postAbsenceRejectedDeduction = calculation.postAbsenceRejectedDeduction;
      payroll.penaltyDeductions = calculation.penaltyDeductions;
      payroll.leaveDeduction = calculation.leaveDeduction;
      payroll.deductions = calculation.totalDeductions;
      payroll.deductionBreakdownNotes = calculation.breakdownNotes;
      payroll.netSalary = calculation.netSalary;
      await payroll.save();
    } else {
      // Calculate salary & deductions from employee profile for this month
      const basicSalary = emp.basicSalary || 0;
      const rawPf = emp.pfAmount || 0;
      const rawMediclaim = emp.mediclaimAmount || 0;

      const joiningDate = new Date(emp.joiningDate || Date.now());
      const monthStart = new Date(y, m - 1, 1);
      let effectiveDays = totalDaysInMonth;
      if (joiningDate > monthStart) {
        effectiveDays = totalDaysInMonth - joiningDate.getDate() + 1;
      }

      const proratedSalary = Math.round((basicSalary / totalDaysInMonth) * effectiveDays);
      const pfDeduction = Math.round((rawPf / totalDaysInMonth) * effectiveDays);
      const mediclaimDeduction = Math.round((rawMediclaim / totalDaysInMonth) * effectiveDays);

      const calculation = await computeSalaryDeductions({
        emp,
        month: m,
        year: y,
        proratedSalary,
        pfDeduction,
        mediclaimDeduction,
        bonus: numAmount,
      });

      payroll = await Payroll.create({
        companyId: tenantId,
        employeeId: emp._id,
        monthYear: targetMonthYear,
        type: 'Regular',
        baseSalary: proratedSalary,
        bonus: numAmount,
        bonusReason: reason || 'Performance Incentive',
        pfDeduction,
        mediclaimDeduction,
        leaveDeduction: calculation.leaveDeduction,
        inactiveCount: calculation.inactiveCount,
        inactiveDeduction: calculation.inactiveDeduction,
        yearlyUnapprovedAbsences: calculation.yearlyUnapprovedAbsences,
        unapprovedAbsenceDeduction: calculation.unapprovedAbsenceDeduction,
        postAbsenceApprovedLeaves: calculation.postAbsenceApprovedLeaves,
        postAbsenceApprovedDeduction: calculation.postAbsenceApprovedDeduction,
        postAbsenceRejectedLeaves: calculation.postAbsenceRejectedLeaves,
        postAbsenceRejectedDeduction: calculation.postAbsenceRejectedDeduction,
        penaltyDeductions: calculation.penaltyDeductions,
        deductions: calculation.totalDeductions,
        deductionBreakdownNotes: calculation.breakdownNotes,
        netSalary: calculation.netSalary,
        totalDaysInMonth,
        effectiveDays,
        status: 'Unpaid',
      });
    }

    // In-app Notification for the employee
    await Notification.create({
      companyId: tenantId,
      userId: emp._id,
      type: 'bonus_awarded',
      title: '🎉 Special Bonus Awarded!',
      message: `Congratulations! A bonus of ₹${numAmount.toLocaleString()} has been awarded for ${targetMonthYear}${reason ? ` (${reason})` : ''}. It is added to your net salary payslip.`,
      link: '/employee/payslips',
    }).catch((e) => console.error('Bonus notification error:', e));

    // Send Email to employee
    sendEmail({
      to: emp.email,
      subject: `🎉 Special Bonus Awarded - ₹${numAmount.toLocaleString()} Added to Your ${targetMonthYear} Salary!`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:36px 32px;text-align:center;">
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;">🎉 Congratulations, ${emp.name}!</h1>
            <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Special Performance &amp; Incentive Bonus Awarded</p>
          </div>
          <div style="padding:32px 28px;">
            <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 20px;">
              We are pleased to inform you that a special bonus of <strong>₹${numAmount.toLocaleString()}</strong> has been approved by Management and added to your salary for <strong>${targetMonthYear}</strong>.
            </p>
            <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;color:#cbd5e1;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;">Employee Code:</td>
                  <td style="padding:6px 0;font-weight:bold;color:#e2e8f0;text-align:right;">${emp.employeeCode || '—'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;">Bonus Reason / Category:</td>
                  <td style="padding:6px 0;color:#a78bfa;font-weight:600;text-align:right;">${reason || 'Performance Incentive'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;">Salary Period:</td>
                  <td style="padding:6px 0;color:#e2e8f0;text-align:right;">${targetMonthYear}</td>
                </tr>
                <tr style="border-top:1px solid #334155;">
                  <td style="padding:10px 0;font-size:15px;color:#f1f5f9;"><strong>Bonus Amount:</strong></td>
                  <td style="padding:10px 0;font-size:16px;font-weight:bold;color:#34d399;text-align:right;">+ ₹${numAmount.toLocaleString()}</td>
                </tr>
                <tr style="border-top:1px solid #334155;">
                  <td style="padding:10px 0;font-size:15px;color:#f1f5f9;"><strong>Updated Net Salary:</strong></td>
                  <td style="padding:10px 0;font-size:16px;font-weight:bold;color:#38bdf8;text-align:right;">₹${payroll.netSalary.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 20px;">
              📄 Your monthly payslip for ${targetMonthYear} has been automatically updated with this bonus amount and added to your net salary. You can view or download it anytime from the Employee Portal.
            </p>
          </div>
          <div style="background:#090d16;padding:16px;text-align:center;border-top:1px solid #1e293b;">
            <p style="margin:0;font-size:11px;color:#64748b;">&copy; 2026 Employee Tracker Enterprise. All Rights Reserved.</p>
          </div>
        </div>
      `,
    }).catch((e) => console.error('Bonus Email Error:', e));

    res.status(200).json({
      message: `Bonus of ₹${numAmount.toLocaleString()} generated for ${emp.name} (${targetMonthYear}) and added to payslip successfully!`,
      payroll,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  generatePayroll,
  generateSinglePayroll,
  getMyPayslips,
  getAllPayroll,
  markAsPaid,
  generateBonus,
  runAutoPayrollJob,
  triggerAutoPayroll,
  processEmployeePayrollRecord,
};

const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

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

// @desc    Generate payroll for all employees for a given month
// @route   POST /api/payroll/generate
// @access  Private (Admin, HR)
const generatePayroll = async (req, res) => {
  try {
    const { monthYear } = req.body; // MM-YYYY

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
    const lastDayOfMonth   = new Date(year, month, 0, 23, 59, 59, 999); // last instant of the month

    // ── Only fetch employees who:
    //    1. Have a basicSalary > 0
    //    2. Joined on or before the last day of the selected month
    //    3. Are NOT Admin role
    const ADMIN_ROLES = ['Admin'];
    const employees = await User.find({
      role: { $nin: ADMIN_ROLES },
      basicSalary: { $gt: 0 },
      joiningDate: { $lte: lastDayOfMonth },
    });

    if (employees.length === 0) {
      return res.status(400).json({ message: 'No eligible employees found for this month' });
    }

    const payrollResults = [];

    for (const emp of employees) {
      const basicSalary = emp.basicSalary;

      // ── Prorate for mid-month joiners ─────────────────────────────
      const joiningDate  = new Date(emp.joiningDate);
      const monthStart   = new Date(year, month - 1, 1);

      let effectiveDays = totalDaysInMonth;

      if (joiningDate > monthStart) {
        // Employee joined mid-month — count from joining day to end of month
        effectiveDays = totalDaysInMonth - joiningDate.getDate() + 1;
      }

      // Prorate salary based on effective days
      const proratedSalary = Math.round((basicSalary / totalDaysInMonth) * effectiveDays);

      // ── Compute real PF & Mediclaim deductions (prorated) ─────────
      const rawPf        = emp.pfAmount || 0;
      const rawMediclaim = emp.mediclaimAmount || 0;

      const pfDeduction        = Math.round((rawPf / totalDaysInMonth) * effectiveDays);
      const mediclaimDeduction = Math.round((rawMediclaim / totalDaysInMonth) * effectiveDays);

      // ── Upsert: update if exists, create if not ───────────────────
      const existingPayroll = await Payroll.findOne({
        employeeId: emp._id,
        monthYear,
      });

      // Preserve any existing bonus awarded for this month!
      const bonus       = existingPayroll ? (existingPayroll.bonus || 0) : 0;
      const bonusReason = existingPayroll ? (existingPayroll.bonusReason || '') : '';

      // Compute disciplinary, attendance & leave penalties according to the 5 rules
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

      // Track whether this is a brand-new payroll (to avoid double accumulation on re-generate)
      let isNewPayroll = false;
      let prevPf = 0;
      let prevMediclaim = 0;

      let payroll;
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
        payrollResults.push({ employee: emp.name, status: 'Updated', payroll });
      } else {
        isNewPayroll = true;
        payroll = await Payroll.create({
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
        payrollResults.push({ employee: emp.name, status: 'Generated', payroll });
      }

      // ── Accumulate PF & Mediclaim on User (delta-safe for re-generation) ──
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

      // In-app notification for the employee (fire and forget)
      Notification.create({
        userId: emp._id,
        type: 'payroll_generated',
        title: 'Payslip Updated',
        message: `Your payslip for ${monthYear} has been generated. Net salary: ₹${netSalary.toLocaleString()}.`,
        link: '/employee/payslips',
      }).catch(err => console.error('Payroll Notif Error:', err));

      // Send email notification (fire and forget)
      sendEmail({
        to: emp.email,
        subject: `Payslip Generated - ${monthYear}`,
        html: `
          <h2>Monthly Payslip - ${monthYear}</h2>
          <p>Dear ${emp.name},</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr><td><strong>Base Salary</strong></td><td>₹${proratedSalary.toLocaleString()}</td></tr>
            ${effectiveDays < totalDaysInMonth
              ? `<tr><td><strong>Note</strong></td><td>Prorated for ${effectiveDays} of ${totalDaysInMonth} days</td></tr>`
              : ''}
            ${bonus > 0 ? `<tr><td><strong>Bonus ${bonusReason ? `(${bonusReason})` : ''}</strong></td><td style="color:#059669;font-weight:bold;">+ ₹${bonus.toLocaleString()}</td></tr>` : ''}
            <tr><td><strong>Provident Fund (PF - 12%)</strong></td><td style="color:#dc2626;">- ₹${pfDeduction.toLocaleString()}</td></tr>
            <tr><td><strong>Mediclaim Health Fund</strong></td><td style="color:#dc2626;">- ₹${mediclaimDeduction.toLocaleString()}</td></tr>
            ${inactiveDeduction > 0 ? `<tr><td><strong>Inactivity Penalty (≥155 times, 1%)</strong></td><td style="color:#dc2626;">- ₹${inactiveDeduction.toLocaleString()}</td></tr>` : ''}
            ${unapprovedAbsenceDeduction > 0 ? `<tr><td><strong>Unapproved Absences Penalty (≥5/yr, 1%)</strong></td><td style="color:#dc2626;">- ₹${unapprovedAbsenceDeduction.toLocaleString()}</td></tr>` : ''}
            ${postAbsenceApprovedDeduction > 0 ? `<tr><td><strong>Post-Absence Approved Leave Penalty (0.5%)</strong></td><td style="color:#d97706;">- ₹${postAbsenceApprovedDeduction.toLocaleString()}</td></tr>` : ''}
            ${postAbsenceRejectedDeduction > 0 ? `<tr><td><strong>Post-Absence Rejected Leave Penalty (1%)</strong></td><td style="color:#dc2626;">- ₹${postAbsenceRejectedDeduction.toLocaleString()}</td></tr>` : ''}
            <tr style="border-top:2px solid #cbd5e1;"><td><strong>Total Deductions</strong></td><td style="color:#dc2626;font-weight:bold;">- ₹${totalDeductions.toLocaleString()}</td></tr>
            <tr style="background:#f0fdf4;border-top:2px solid #16a34a;"><td><strong>Net Take-Home Salary</strong></td><td style="color:#16a34a;font-weight:bold;font-size:16px;">₹${netSalary.toLocaleString()}</td></tr>
          </table>
          ${breakdownNotes.length > 0 ? `
            <div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#475569;">
              <strong>Salary Calculation &amp; Deduction Details:</strong>
              <ul style="margin:6px 0 0;padding-left:18px;">
                ${breakdownNotes.map(n => `<li>${n}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <p>Best regards,<br/>HR Team</p>
        `,
      }).catch(err => console.error('Payroll Email Error:', err));
    }

    res.status(201).json({
      message: `Payroll processed for ${payrollResults.length} employees`,
      results: payrollResults,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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

// @desc    Get all payroll records (Admin/HR)
// @route   GET /api/payroll/all
// @access  Private (Admin, HR)
const getAllPayroll = async (req, res) => {
  try {
    const { monthYear } = req.query;
    const filter = {};
    if (monthYear) filter.monthYear = monthYear;

    const payrolls = await Payroll.find(filter)
      .populate('employeeId', 'name email department designation employeeCode role pfId mediclaimId bankDetails basicSalary pfAmount mediclaimAmount totalPfAccumulated totalMediclaimAccumulated phone')
      .sort({ createdAt: -1 });

    // Return data as-is from database — no dummy enrichment
    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update payroll status (Paid, Unpaid, Pending)
// @route   PUT /api/payroll/mark-paid/:id
// @access  Private (Admin, HR)
const markAsPaid = async (req, res) => {
  try {
    const { status } = req.body;
    const newStatus = status && ['Paid', 'Unpaid', 'Pending'].includes(status) ? status : 'Paid';

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    payroll.status = newStatus;
    await payroll.save();

    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Generate / Award bonus to an employee (adds directly into monthly payslip)
// @route   POST /api/payroll/generate-bonus
// @access  Private (Admin, HR)
const generateBonus = async (req, res) => {
  try {
    const { employeeId, amount, monthYear, reason } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required.' });
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a valid bonus amount greater than 0.' });
    }

    const emp = await User.findById(employeeId);
    if (!emp) {
      return res.status(404).json({ message: 'Employee not found.' });
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
  getMyPayslips,
  getAllPayroll,
  markAsPaid,
  generateBonus,
};

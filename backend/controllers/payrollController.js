const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

// ── Helper: get the number of calendar days in a month ──────────────
const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();

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
      const leaveDeduction     = 0;
      const bonus              = 0;
      const totalDeductions    = pfDeduction + mediclaimDeduction + leaveDeduction;

      const netSalary = proratedSalary - totalDeductions + bonus;

      // ── Upsert: update if exists, create if not ───────────────────
      const existingPayroll = await Payroll.findOne({
        employeeId: emp._id,
        monthYear,
      });

      // Track whether this is a brand-new payroll (to avoid double accumulation on re-generate)
      let isNewPayroll = false;
      let prevPf = 0;
      let prevMediclaim = 0;

      let payroll;
      if (existingPayroll) {
        prevPf        = existingPayroll.pfDeduction || 0;
        prevMediclaim = existingPayroll.mediclaimDeduction || 0;

        existingPayroll.baseSalary          = proratedSalary;
        existingPayroll.bonus               = bonus;
        existingPayroll.pfDeduction         = pfDeduction;
        existingPayroll.mediclaimDeduction   = mediclaimDeduction;
        existingPayroll.leaveDeduction      = leaveDeduction;
        existingPayroll.deductions          = totalDeductions;
        existingPayroll.netSalary           = netSalary;
        existingPayroll.totalDaysInMonth    = totalDaysInMonth;
        existingPayroll.effectiveDays       = effectiveDays;
        payroll = await existingPayroll.save();
        payrollResults.push({ employee: emp.name, status: 'Updated', payroll });
      } else {
        isNewPayroll = true;
        payroll = await Payroll.create({
          employeeId: emp._id,
          monthYear,
          baseSalary: proratedSalary,
          bonus,
          pfDeduction,
          mediclaimDeduction,
          leaveDeduction,
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
            <tr><td><strong>PF Deduction</strong></td><td>- ₹${pfDeduction.toLocaleString()}</td></tr>
            <tr><td><strong>Mediclaim Deduction</strong></td><td>- ₹${mediclaimDeduction.toLocaleString()}</td></tr>
            <tr style="background:#f0fdf4;"><td><strong>Net Salary</strong></td><td><strong>₹${netSalary.toLocaleString()}</strong></td></tr>
          </table>
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
    const payslips = await Payroll.find({ employeeId: req.user._id }).sort({ createdAt: -1 });
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
      .populate('employeeId', 'name email department designation employeeCode role bankDetails basicSalary pfAmount mediclaimAmount totalPfAccumulated totalMediclaimAccumulated phone')
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

module.exports = {
  generatePayroll,
  getMyPayslips,
  getAllPayroll,
  markAsPaid,
};

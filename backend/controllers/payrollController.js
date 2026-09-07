const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Performance = require('../models/Performance');
const sendEmail = require('../utils/sendEmail');
const Notification = require('../models/Notification');

// @desc    Generate payroll for all employees for a given month
// @route   POST /api/payroll/generate
// @access  Private (Admin, HR)
const generatePayroll = async (req, res) => {
  try {
    const { monthYear } = req.body; // MM-YYYY

    if (!monthYear) {
      return res.status(400).json({ message: 'monthYear is required (MM-YYYY)' });
    }

    const [month, year] = monthYear.split('-');
    if (!month || !year) {
      return res.status(400).json({ message: 'Invalid monthYear format. Use MM-YYYY' });
    }

    // Get all employees (not Admin)
    const employees = await User.find({ role: { $in: ['Employee', 'HR'] } });

    if (employees.length === 0) {
      return res.status(400).json({ message: 'No employees found' });
    }

    const payrollResults = [];

    for (const emp of employees) {
      const basicSalary = emp.basicSalary || 0;

      // Count absent days (days with no attendance record & no approved leave)
      const totalWorkingDays = 30;

      // Count days employee was present
      const datePrefix = `${year}-${month.padStart(2, '0')}`;
      const attendanceRecords = await Attendance.find({
        employeeId: emp._id,
        date: { $regex: `^${datePrefix}` },
        status: { $in: ['Present', 'Late'] },
      });

      const presentDays = attendanceRecords.length;

      // Count approved leave days for this month
      const approvedLeaves = await require('../models/Leave').find({
        employeeId: emp._id,
        status: 'Approved',
        startDate: { $lte: new Date(`${year}-${month.padStart(2, '0')}-31`) },
        endDate: { $gte: new Date(`${year}-${month.padStart(2, '0')}-01`) },
      });

      let leaveDays = 0;
      for (const leave of approvedLeaves) {
        const start = new Date(Math.max(leave.startDate, new Date(`${year}-${month.padStart(2, '0')}-01`)));
        const end = new Date(Math.min(leave.endDate, new Date(`${year}-${month.padStart(2, '0')}-31`)));
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        leaveDays += days;
      }

      const absentDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);

      // Detailed deduction calculations
      const pfDeduction = Math.round(basicSalary * 0.12);
      const mediclaimDeduction = basicSalary > 0 ? 1000 : 0;
      const leaveDeduction = Math.round((basicSalary / 30) * absentDays);
      const totalDeductions = pfDeduction + mediclaimDeduction + leaveDeduction;

      // Check performance rating for bonus
      const performance = await Performance.findOne({
        employeeId: emp._id,
        monthYear,
      });

      let bonus = 0;
      if (performance && performance.kpiRating === 5) {
        bonus = Math.round(basicSalary * 0.10); // 10% bonus for perfect rating
      }

      const netSalary = Math.max(0, basicSalary + bonus - totalDeductions);

      // Upsert: Check if payroll already exists for this employee & month
      const existingPayroll = await Payroll.findOne({
        employeeId: emp._id,
        monthYear,
      });

      let payroll;
      if (existingPayroll) {
        existingPayroll.baseSalary = basicSalary;
        existingPayroll.bonus = bonus;
        existingPayroll.pfDeduction = pfDeduction;
        existingPayroll.mediclaimDeduction = mediclaimDeduction;
        existingPayroll.leaveDeduction = leaveDeduction;
        existingPayroll.deductions = totalDeductions;
        existingPayroll.netSalary = netSalary;
        payroll = await existingPayroll.save();
        payrollResults.push({ employee: emp.name, status: 'Updated', payroll });
      } else {
        payroll = await Payroll.create({
          employeeId: emp._id,
          monthYear,
          baseSalary: basicSalary,
          bonus,
          pfDeduction,
          mediclaimDeduction,
          leaveDeduction,
          deductions: totalDeductions,
          netSalary,
          status: 'Unpaid',
        });
        payrollResults.push({ employee: emp.name, status: 'Generated', payroll });
      }

      // In-app notification for the employee
      await Notification.create({
        userId: emp._id,
        type: 'payroll_generated',
        title: 'Payslip Updated',
        message: `Your payslip for ${monthYear} has been generated/updated. Net salary: ₹${netSalary.toLocaleString()}.`,
        link: '/employee/payslips',
      }).catch(() => {});

      // Send email notification
      await sendEmail({
        to: emp.email,
        subject: `Payslip Generated - ${monthYear}`,
        html: `
          <h2>Monthly Payslip - ${monthYear}</h2>
          <p>Dear ${emp.name},</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr><td><strong>Base Salary</strong></td><td>₹${basicSalary.toLocaleString()}</td></tr>
            <tr><td><strong>Bonus</strong></td><td>₹${bonus.toLocaleString()}</td></tr>
            <tr><td><strong>Mediclaim Deduction</strong></td><td>₹${mediclaimDeduction.toLocaleString()}</td></tr>
            <tr><td><strong>PF Deduction (12%)</strong></td><td>₹${pfDeduction.toLocaleString()}</td></tr>
            <tr><td><strong>Leave & Attendance Deductions</strong></td><td>₹${leaveDeduction.toLocaleString()}</td></tr>
            <tr><td><strong>Total Deductions</strong></td><td>₹${totalDeductions.toLocaleString()}</td></tr>
            <tr><td><strong>Net Salary</strong></td><td>₹${netSalary.toLocaleString()}</td></tr>
          </table>
          <p>Best regards,<br/>HR Team</p>
        `,
      }).catch(() => {});
    }

    res.status(201).json({
      message: `Payroll processed/updated for ${payrollResults.length} employees`,
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
      .populate('employeeId', 'name email department designation employeeCode role bankDetails basicSalary phone')
      .sort({ createdAt: -1 });

    const enriched = payrolls.map((p) => {
      const obj = p.toObject();
      const base = obj.baseSalary || obj.employeeId?.basicSalary || 0;
      const pf = obj.pfDeduction !== undefined && obj.pfDeduction !== null && obj.pfDeduction > 0 
        ? obj.pfDeduction 
        : Math.round(base * 0.12);
      const medi = obj.mediclaimDeduction !== undefined && obj.mediclaimDeduction !== null && obj.mediclaimDeduction > 0
        ? obj.mediclaimDeduction
        : (base > 0 ? 1000 : 0);
      const leave = obj.leaveDeduction !== undefined && obj.leaveDeduction !== null
        ? obj.leaveDeduction
        : (obj.deductions || 0);

      obj.pfDeduction = pf;
      obj.mediclaimDeduction = medi;
      obj.leaveDeduction = leave;
      obj.deductions = pf + medi + leave;
      obj.netSalary = Math.max(0, base + (obj.bonus || 0) - obj.deductions);
      return obj;
    });

    res.json(enriched);
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


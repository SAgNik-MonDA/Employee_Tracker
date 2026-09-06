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
      // Check if payroll already generated for this employee & month
      const existingPayroll = await Payroll.findOne({
        employeeId: emp._id,
        monthYear,
      });

      if (existingPayroll) {
        payrollResults.push({ employee: emp.name, status: 'Already Generated', payroll: existingPayroll });
        continue;
      }

      const basicSalary = emp.basicSalary;

      // Count absent days (days with no attendance record & no approved leave)
      // Get total working days in the month (approximate: 30)
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
      const deductions = Math.round((basicSalary / 30) * absentDays);

      // Check performance rating for bonus
      const performance = await Performance.findOne({
        employeeId: emp._id,
        monthYear,
      });

      let bonus = 0;
      if (performance && performance.kpiRating === 5) {
        bonus = Math.round(basicSalary * 0.10); // 10% bonus for perfect rating
      }

      const netSalary = basicSalary + bonus - deductions;

      const payroll = await Payroll.create({
        employeeId: emp._id,
        monthYear,
        baseSalary: basicSalary,
        bonus,
        deductions,
        netSalary: Math.max(0, netSalary),
        status: 'Unpaid',
      });

      payrollResults.push({ employee: emp.name, status: 'Generated', payroll });

      // In-app notification for the employee
      await Notification.create({
        userId: emp._id,
        type: 'payroll_generated',
        title: 'Payslip Generated',
        message: `Your payslip for ${monthYear} has been generated. Net salary: ₹${Math.max(0, netSalary).toLocaleString()}.`,
        link: '/employee/payslips',
      });

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
            <tr><td><strong>Deductions</strong></td><td>₹${deductions.toLocaleString()}</td></tr>
            <tr><td><strong>Net Salary</strong></td><td>₹${Math.max(0, netSalary).toLocaleString()}</td></tr>
          </table>
          <p>Best regards,<br/>HR Team</p>
        `,
      });
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
      .populate('employeeId', 'name email department designation')
      .sort({ createdAt: -1 });

    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark payroll as paid
// @route   PUT /api/payroll/mark-paid/:id
// @access  Private (Admin, HR)
const markAsPaid = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    payroll.status = 'Paid';
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

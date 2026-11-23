const cron = require('node-cron');
const { runAutoPayrollJob } = require('../controllers/payrollController');

/**
 * Automated Monthly Payroll & Statutory Fund Deductions Scheduler
 *
 * Runs automatically on the 2nd day of every month at 00:05 AM IST.
 * Deducts PF & Mediclaim from salary, computes net salary based on 5 enterprise
 * attendance/disciplinary rules, accumulates funds in employee accounts, and
 * dispatches notifications & comprehensive email advice to each employee.
 */
const startAutoPayrollScheduler = () => {
  // Cron schedule: 5 minutes past midnight on the 2nd day of every month (IST)
  cron.schedule(
    '5 0 2 * *',
    async () => {
      console.log('⏰ [Auto Payroll Scheduler] Running automated payroll & statutory fund deductions on 2nd of month...');
      try {
        const result = await runAutoPayrollJob();
        console.log(`✅ [Auto Payroll Scheduler] Completed run for ${result.targetMonthYear} (${result.count} employees processed).`);
      } catch (err) {
        console.error('❌ [Auto Payroll Scheduler] Error executing automated payroll run:', err.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('[Auto Payroll Scheduler] Started — active for 2nd of every month at 00:05 AM IST');
};

module.exports = { startAutoPayrollScheduler };

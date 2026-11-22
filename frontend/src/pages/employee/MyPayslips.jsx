import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';

const MyPayslips = () => {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchPayslips();
  }, []);

  const fetchPayslips = async () => {
    try {
      const { data } = await API.get('/payroll/my-slips');
      setPayslips(data);
    } catch (error) {
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = (payslip) => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYSLIP', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Month: ${payslip.monthYear}`, 105, 32, { align: 'center' });

    // Employee Details
    const emp = payslip.employeeId || user || {};
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', 14, 52);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Name: ${emp.name || '-'}`, 14, 60);
    doc.text(`Employee Code: ${emp.employeeCode || user?.employeeCode || '-'}`, 14, 66);
    doc.text(`Department: ${emp.department || '-'}`, 14, 72);
    doc.text(`Designation: ${emp.designation || '-'}`, 14, 78);
    doc.text(`Mediclaim ID: ${emp.mediclaimId || user?.mediclaimId || 'Not Generated'}`, 14, 84);
    doc.text(`PF ID: ${emp.pfId || user?.pfId || 'Not Generated'}`, 14, 90);

    // Itemized Deductions rows
    const deductionRows = [
      ['Provident Fund (PF - 12%)', `- ₹${(payslip.pfDeduction || 0).toLocaleString()}`],
      ['Mediclaim Health Fund', `- ₹${(payslip.mediclaimDeduction || 0).toLocaleString()}`],
    ];

    if (payslip.inactiveDeduction > 0 || (payslip.inactiveCount >= 155)) {
      deductionRows.push([
        `Inactivity Penalty (≥155 times, ${payslip.inactiveCount || 0} counts - 1%)`,
        `- ₹${(payslip.inactiveDeduction || 0).toLocaleString()}`
      ]);
    }

    if (payslip.unapprovedAbsenceDeduction > 0 || (payslip.yearlyUnapprovedAbsences >= 5)) {
      deductionRows.push([
        `Unapproved Absence Penalty (≥5/yr, ${payslip.yearlyUnapprovedAbsences || 0} days - 1%)`,
        `- ₹${(payslip.unapprovedAbsenceDeduction || 0).toLocaleString()}`
      ]);
    }

    if (payslip.postAbsenceApprovedDeduction > 0 || payslip.postAbsenceApprovedLeaves > 0) {
      deductionRows.push([
        `Post-Absence Approved Leave Penalty (${payslip.postAbsenceApprovedLeaves || 0} leave - 0.5%)`,
        `- ₹${(payslip.postAbsenceApprovedDeduction || 0).toLocaleString()}`
      ]);
    }

    if (payslip.postAbsenceRejectedDeduction > 0 || payslip.postAbsenceRejectedLeaves > 0) {
      deductionRows.push([
        `Post-Absence Rejected Leave Penalty (${payslip.postAbsenceRejectedLeaves || 0} leave - 1%)`,
        `- ₹${(payslip.postAbsenceRejectedDeduction || 0).toLocaleString()}`
      ]);
    }

    const specificPenalties = (payslip.inactiveDeduction || 0) + (payslip.unapprovedAbsenceDeduction || 0) + (payslip.postAbsenceApprovedDeduction || 0) + (payslip.postAbsenceRejectedDeduction || 0);
    const otherLeaveDeductions = (payslip.leaveDeduction || 0) - specificPenalties;
    if (otherLeaveDeductions > 0) {
      deductionRows.push([
        'Other Leave / Late Attendance Deductions',
        `- ₹${otherLeaveDeductions.toLocaleString()}`
      ]);
    }

    // Salary Table
    const startY = 100;
    const tableBody = [
      ['Base Salary', `₹${(payslip.baseSalary || 0).toLocaleString()}`],
      ['Bonus' + (payslip.bonusReason ? ` (${payslip.bonusReason})` : ''), `+ ₹${(payslip.bonus || 0).toLocaleString()}`],
      ...deductionRows,
      ['Total Deductions', `- ₹${(payslip.deductions || 0).toLocaleString()}`],
    ];

    if (payslip.effectiveDays && payslip.totalDaysInMonth && payslip.effectiveDays < payslip.totalDaysInMonth) {
      tableBody.push(['Days Worked', `${payslip.effectiveDays} / ${payslip.totalDaysInMonth} (Prorated)`]);
    }

    tableBody.push(
      ['', ''],
      ['Net Salary (Take-Home)', `₹${(payslip.netSalary || 0).toLocaleString()}`],
    );

    doc.autoTable({
      startY: startY,
      head: [['Component', 'Amount (₹)']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 11 },
      bodyStyles: { fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 6 },
    });

    // Status
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.text(`Status: ${payslip.status}`, 14, finalY);
    doc.text(`Generated: ${new Date(payslip.createdAt).toLocaleDateString()}`, 14, finalY + 7);

    // Deduction breakdown notes if any
    if (payslip.deductionBreakdownNotes && payslip.deductionBreakdownNotes.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Deduction & Attendance Notes:', 14, finalY + 16);
      payslip.deductionBreakdownNotes.forEach((note, idx) => {
        doc.text(`• ${note}`, 16, finalY + 22 + (idx * 5));
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a system-generated payslip. © 2026 Employee Tracker', 105, 285, { align: 'center' });

    doc.save(`Payslip_${user?.name}_${payslip.monthYear}.pdf`);
    toast.success('Payslip downloaded! 📄');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">My Payslips</h1>
        <p className="text-surface-500 mt-1">View and download your monthly salary slips</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card p-6 animate-pulse">
              <div className="w-24 h-6 bg-surface-700 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="w-full h-4 bg-surface-700 rounded"></div>
                <div className="w-full h-4 bg-surface-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : payslips.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-surface-400">No payslips generated yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {payslips.map((p) => (
            <div key={p._id} className="glass-card-hover p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-lg text-surface-100">{p.monthYear}</h3>
                <span className={p.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}>{p.status}</span>
              </div>
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Base Salary</span>
                  <span className="text-surface-200">₹{(p.baseSalary || 0).toLocaleString()}</span>
                </div>
                {p.effectiveDays && p.totalDaysInMonth && p.effectiveDays < p.totalDaysInMonth && (
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-400">Days Worked</span>
                    <span className="text-amber-400">{p.effectiveDays} / {p.totalDaysInMonth}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-400 flex items-center gap-1.5">
                    <span>Bonus</span>
                    {p.bonusReason && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                        {p.bonusReason}
                      </span>
                    )}
                  </span>
                  <span className="text-emerald-400 font-medium">+₹{(p.bonus || 0).toLocaleString()}</span>
                </div>
                {/* ── Itemized Deductions Section ── */}
                <div className="pt-2 pb-1 border-t border-surface-700/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-surface-400 uppercase tracking-wider">
                    <span>Deduction Breakdown (কাটা টাকার বিবরণ)</span>
                    <span className="text-rose-400 font-mono">-₹{(p.deductions || 0).toLocaleString()}</span>
                  </div>

                  {/* Standard deductions */}
                  <div className="space-y-1 pl-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-400">Provident Fund (PF - 12%)</span>
                      <span className="text-rose-400/90 font-mono font-medium">-₹{(p.pfDeduction || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-400">Mediclaim Health Fund</span>
                      <span className="text-rose-400/90 font-mono font-medium">-₹{(p.mediclaimDeduction || 0).toLocaleString()}</span>
                    </div>

                    {/* Specific Penalties itemized */}
                    {(p.inactiveDeduction > 0 || (p.inactiveCount >= 155)) && (
                      <div className="flex justify-between items-center text-xs bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                        <span className="text-rose-300 font-medium">
                          ⚡ Inactivity Penalty ({p.inactiveCount || 0} times, 1%)
                        </span>
                        <span className="text-rose-400 font-bold font-mono">-₹{(p.inactiveDeduction || 0).toLocaleString()}</span>
                      </div>
                    )}

                    {(p.unapprovedAbsenceDeduction > 0 || (p.yearlyUnapprovedAbsences >= 5)) && (
                      <div className="flex justify-between items-center text-xs bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                        <span className="text-rose-300 font-medium">
                          ⚠️ Unapproved Absences ({p.yearlyUnapprovedAbsences || 0} days, 1%)
                        </span>
                        <span className="text-rose-400 font-bold font-mono">-₹{(p.unapprovedAbsenceDeduction || 0).toLocaleString()}</span>
                      </div>
                    )}

                    {p.postAbsenceApprovedDeduction > 0 && (
                      <div className="flex justify-between items-center text-xs bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                        <span className="text-amber-300 font-medium">
                          📝 Post-Absence Approved ({p.postAbsenceApprovedLeaves || 0} leave, 0.5%)
                        </span>
                        <span className="text-amber-400 font-bold font-mono">-₹{p.postAbsenceApprovedDeduction.toLocaleString()}</span>
                      </div>
                    )}

                    {p.postAbsenceRejectedDeduction > 0 && (
                      <div className="flex justify-between items-center text-xs bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                        <span className="text-rose-300 font-medium">
                          ❌ Post-Absence Rejected ({p.postAbsenceRejectedLeaves || 0} leave, 1%)
                        </span>
                        <span className="text-rose-400 font-bold font-mono">-₹{p.postAbsenceRejectedDeduction.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Any other leave deduction */}
                    {(() => {
                      const specific = (p.inactiveDeduction || 0) + (p.unapprovedAbsenceDeduction || 0) + (p.postAbsenceApprovedDeduction || 0) + (p.postAbsenceRejectedDeduction || 0);
                      const other = (p.leaveDeduction || 0) - specific;
                      if (other > 0) {
                        return (
                          <div className="flex justify-between text-xs">
                            <span className="text-surface-400">Other Leave / Late Deductions</span>
                            <span className="text-rose-400/90 font-mono">-₹{other.toLocaleString()}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="flex justify-between text-sm pt-1 border-t border-surface-700/40">
                  <span className="text-surface-300 font-semibold">Total Deductions</span>
                  <span className="text-rose-400 font-bold font-mono">-₹{(p.deductions || 0).toLocaleString()}</span>
                </div>

                {p.deductionBreakdownNotes && p.deductionBreakdownNotes.length > 0 && (
                  <div className="text-[11px] text-surface-400 bg-surface-900/60 p-2.5 rounded-lg border border-surface-700/50 space-y-1">
                    <span className="font-semibold text-surface-300 block mb-0.5">Disciplinary Notes:</span>
                    {p.deductionBreakdownNotes.map((note, idx) => (
                      <p key={idx} className="flex items-start gap-1.5 text-surface-300">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{note}</span>
                      </p>
                    ))}
                  </div>
                )}
                <hr className="border-surface-700/50" />
                <div className="flex justify-between font-semibold">
                  <span className="text-surface-300">Net Salary</span>
                  <span className="text-primary-400 text-lg">₹{(p.netSalary || 0).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => downloadPDF(p)}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
              >
                📥 Download PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyPayslips;

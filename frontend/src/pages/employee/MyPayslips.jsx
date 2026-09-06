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
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${user?.name || '-'}`, 14, 65);
    doc.text(`Email: ${user?.email || '-'}`, 14, 72);
    doc.text(`Department: ${user?.department || '-'}`, 14, 79);
    doc.text(`Designation: ${user?.designation || '-'}`, 14, 86);

    // Salary Table
    doc.autoTable({
      startY: 100,
      head: [['Component', 'Amount (₹)']],
      body: [
        ['Base Salary', `₹${payslip.baseSalary.toLocaleString()}`],
        ['Bonus', `₹${payslip.bonus.toLocaleString()}`],
        ['Deductions', `- ₹${payslip.deductions.toLocaleString()}`],
        ['', ''],
        ['Net Salary', `₹${payslip.netSalary.toLocaleString()}`],
      ],
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
                  <span className="text-surface-200">₹{p.baseSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Bonus</span>
                  <span className="text-emerald-400">+₹{p.bonus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-surface-400">Deductions</span>
                  <span className="text-rose-400">-₹{p.deductions.toLocaleString()}</span>
                </div>
                <hr className="border-surface-700/50" />
                <div className="flex justify-between font-semibold">
                  <span className="text-surface-300">Net Salary</span>
                  <span className="text-primary-400 text-lg">₹{p.netSalary.toLocaleString()}</span>
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

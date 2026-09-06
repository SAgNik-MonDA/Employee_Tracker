import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const GeneratePayroll = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState('');
  const [viewMonthYear, setViewMonthYear] = useState('');

  useEffect(() => {
    // Default to current month
    const now = new Date();
    const current = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    setSelectedMonthYear(current);
    setViewMonthYear(current);
  }, []);

  useEffect(() => {
    if (viewMonthYear) fetchPayrolls();
  }, [viewMonthYear]);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/payroll/all?monthYear=${viewMonthYear}`);
      setPayrolls(data);
    } catch (error) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedMonthYear) {
      toast.error('Please select a month');
      return;
    }

    setGenerating(true);
    try {
      const { data } = await API.post('/payroll/generate', { monthYear: selectedMonthYear });
      toast.success(data.message);
      setViewMonthYear(selectedMonthYear);
      fetchPayrolls();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Payroll generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await API.put(`/payroll/mark-paid/${id}`);
      toast.success('Marked as paid ✅');
      fetchPayrolls();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const downloadPayslip = (p) => {
    const doc = new jsPDF();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYSLIP', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Month: ${p.monthYear}`, 105, 32, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Details', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${p.employeeId?.name || '-'}`, 14, 65);
    doc.text(`Email: ${p.employeeId?.email || '-'}`, 14, 72);
    doc.text(`Department: ${p.employeeId?.department || '-'}`, 14, 79);

    doc.autoTable({
      startY: 95,
      head: [['Component', 'Amount (₹)']],
      body: [
        ['Base Salary', `₹${p.baseSalary.toLocaleString()}`],
        ['Bonus', `₹${p.bonus.toLocaleString()}`],
        ['Deductions', `- ₹${p.deductions.toLocaleString()}`],
        ['', ''],
        ['Net Salary', `₹${p.netSalary.toLocaleString()}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 11 },
      bodyStyles: { fontSize: 10 },
      styles: { cellPadding: 6 },
    });

    doc.save(`Payslip_${p.employeeId?.name || 'employee'}_${p.monthYear}.pdf`);
    toast.success('PDF downloaded! 📄');
  };

  // Generate monthYear options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
    monthOptions.push({ value: val, label });
  }

  const totalPayroll = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-surface-100">
          {isAdmin ? 'Generate Payroll' : 'Payroll Records'}
        </h1>
        <p className="text-surface-500 mt-1">
          {isAdmin ? 'Process monthly salary for all employees' : 'View monthly salary records'}
        </p>
      </div>

      {/* Generate Card — Admin only */}
      {isAdmin && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-surface-100 mb-4">Process Payroll</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Select Month</label>
              <select
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="select-field w-auto"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                '💰 Generate Payroll'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-surface-100">
              Payroll Records — {viewMonthYear}
            </h2>
            <p className="text-sm text-surface-500 mt-1">
              Total: <strong className="text-primary-400">₹{totalPayroll.toLocaleString()}</strong> ({payrolls.length} employees)
            </p>
          </div>
          <select
            value={viewMonthYear}
            onChange={(e) => setViewMonthYear(e.target.value)}
            className="select-field w-auto"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Base Salary</th>
                <th>Bonus</th>
                <th>Deductions</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-surface-500">No payroll records for this month</td></tr>
              ) : (
                payrolls.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                          {p.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-surface-200">
                            {p.employeeId?.name || 'Unknown'} {p.employeeId?.employeeCode && <span className="text-xs font-mono text-surface-400 ml-1">({p.employeeId.employeeCode})</span>}
                          </p>
                          <p className="text-xs text-surface-500">{p.employeeId?.department || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-surface-300">₹{p.baseSalary.toLocaleString()}</td>
                    <td className="text-emerald-400">+₹{p.bonus.toLocaleString()}</td>
                    <td className="text-rose-400">-₹{p.deductions.toLocaleString()}</td>
                    <td className="font-semibold text-primary-400">₹{p.netSalary.toLocaleString()}</td>
                    <td>
                      <span className={p.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}>{p.status}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* Mark Paid — Admin only */}
                        {isAdmin && p.status === 'Unpaid' && (
                          <button
                            onClick={() => handleMarkPaid(p._id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          onClick={() => downloadPayslip(p)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-700/50 text-surface-300 hover:bg-surface-600/50 border border-surface-600/50 transition-colors"
                        >
                          📥 PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GeneratePayroll;

import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';

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

  const handleStatusChange = async (id, newStatus) => {
    try {
      await API.put(`/payroll/mark-paid/${id}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus} ✅`);
      fetchPayrolls();
    } catch (error) {
      toast.error('Failed to update status');
    }
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

  const handleDownloadExcel = async (monthYearToExport) => {
    try {
      let recordsToExport = payrolls;
      if (monthYearToExport !== viewMonthYear || payrolls.length === 0) {
        const { data } = await API.get(`/payroll/all?monthYear=${monthYearToExport}`);
        recordsToExport = data;
      }

      if (!recordsToExport || recordsToExport.length === 0) {
        toast.error(`No payroll data found for ${monthYearToExport}`);
        return;
      }

      const monthObj = monthOptions.find((m) => m.value === monthYearToExport);
      const monthLabel = monthObj ? monthObj.label : monthYearToExport;

      // Create ExcelJS Workbook & Worksheet
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Employee Tracker HR System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Salary Report', {
        views: [{ showGridLines: true }]
      });

      // 1. Main Title Banner (Row 1)
      worksheet.mergeCells('A1:Q1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `MONTHLY SALARY PAYROLL REPORT — ${monthLabel.toUpperCase()}`;
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E1B4B' } // Dark Indigo
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 42;

      // 2. Subtitle Meta Row (Row 2)
      worksheet.mergeCells('A2:Q2');
      const metaCell = worksheet.getCell('A2');
      metaCell.value = `Generated Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  |  Total Employees: ${recordsToExport.length}  |  Confidential & Proprietary`;
      metaCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
      metaCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' } // Slate
      };
      metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 24;

      // 3. Blank Separator Row (Row 3)
      worksheet.getRow(3).height = 12;

      // 4. Headers (Row 4)
      const headers = [
        'Employee Name',
        'Employee Code',
        'Role',
        'Designation',
        'Month of Salary',
        'Base Salary (₹)',
        'Mediclaim Deduction (₹)',
        'PF Deduction (₹)',
        'Leave & Attendance Deductions (₹)',
        'Total Deductions (₹)',
        'Net Salary (₹)',
        'Bank Name',
        'Bank Branch Name',
        'IFSC Code',
        'Account Holder Name',
        'Branch Address',
        'Status'
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.values = headers;
      headerRow.height = 30;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4338CA' } // Indigo Header
        };
        cell.alignment = {
          horizontal: colNumber >= 6 && colNumber <= 11 ? 'right' : 'center',
          vertical: 'middle',
          wrapText: true
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF312E81' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF312E81' } },
          right: { style: 'thin', color: { argb: 'FF475569' } }
        };
      });

      // 5. Populate Data Rows (Row 5+)
      let totalBase = 0;
      let totalMedi = 0;
      let totalPF = 0;
      let totalLeave = 0;
      let totalDedSum = 0;
      let totalNet = 0;

      recordsToExport.forEach((p, idx) => {
        const emp = p.employeeId || {};
        const bank = emp.bankDetails || {};
        const base = p.baseSalary || emp.basicSalary || 0;
        const pf = p.pfDeduction !== undefined ? p.pfDeduction : Math.round(base * 0.12);
        const medi = p.mediclaimDeduction !== undefined ? p.mediclaimDeduction : (base > 0 ? 1000 : 0);
        const leave = p.leaveDeduction !== undefined ? p.leaveDeduction : (p.deductions || 0);
        const totalDed = pf + medi + leave;
        const net = Math.max(0, base + (p.bonus || 0) - totalDed);

        totalBase += base;
        totalMedi += medi;
        totalPF += pf;
        totalLeave += leave;
        totalDedSum += totalDed;
        totalNet += net;

        const rowIndex = idx + 5;
        const row = worksheet.getRow(rowIndex);
        row.height = 26;

        // Note: Status column (17) is left completely EMPTY ("") for manual entry as requested!
        row.values = [
          emp.name || '—',
          emp.employeeCode || '—',
          emp.role || '—',
          emp.designation || '—',
          monthLabel,
          base,
          medi,
          pf,
          leave,
          totalDed,
          net,
          bank.bankName || '—',
          bank.branchName || '—',
          bank.ifscCode || '—',
          bank.accountHolderName || '—',
          bank.bankAddress || '—',
          '' // Status left EMPTY for manual editing!
        ];

        const isEven = idx % 2 === 0;
        const bgFill = isEven ? 'FFF8FAFC' : 'FFFFFFFF'; // Zebra striping

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Base Font
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
          
          // Base Alignment & Fill
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgFill }
          };

          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alignments & Number Formats
          if (colNumber >= 6 && colNumber <= 11) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '₹#,##0';
          } else if (colNumber === 2 || colNumber === 5 || colNumber === 14) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }

          // Highlight Specific Columns:
          // Total Deductions (Col 10): Light Red Highlight
          if (colNumber === 10) {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          }

          // Net Salary (Col 11): Light Emerald Highlight
          if (colNumber === 11) {
            cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF065F46' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          }

          // Status Column (Col 17): Soft Light Amber/Yellow tint so user sees it's ready for manual input
          if (colNumber === 17) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } };
            cell.border = {
              top: { style: 'dashed', color: { argb: 'FFCBD5E1' } },
              left: { style: 'dashed', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'dashed', color: { argb: 'FFCBD5E1' } },
              right: { style: 'dashed', color: { argb: 'FFCBD5E1' } }
            };
          }
        });
      });

      // 6. Summary / Total Row
      const summaryRowIndex = recordsToExport.length + 5;
      const summaryRow = worksheet.getRow(summaryRowIndex);
      summaryRow.height = 28;

      worksheet.mergeCells(`A${summaryRowIndex}:E${summaryRowIndex}`);
      const sumLabelCell = worksheet.getCell(`A${summaryRowIndex}`);
      sumLabelCell.value = 'TOTAL PAYROLL SUMMARY';
      sumLabelCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      sumLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sumLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

      summaryRow.getCell(6).value = totalBase;
      summaryRow.getCell(7).value = totalMedi;
      summaryRow.getCell(8).value = totalPF;
      summaryRow.getCell(9).value = totalLeave;
      summaryRow.getCell(10).value = totalDedSum;
      summaryRow.getCell(11).value = totalNet;

      for (let c = 6; c <= 17; c++) {
        const cell = summaryRow.getCell(c);
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: c <= 11 ? 'right' : 'center', vertical: 'middle' };
        if (c <= 11) cell.numFmt = '₹#,##0';
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF475569' } },
          bottom: { style: 'double', color: { argb: 'FFFFFFFF' } }
        };
      }

      // 7. Auto Column Widths
      worksheet.columns.forEach((col) => {
        let maxLen = 14;
        col.eachCell({ includeEmpty: false }, (cell, rowIdx) => {
          if (rowIdx > 3 && cell.value) { // Skip title rows
            const len = String(cell.value).length;
            if (len > maxLen) maxLen = len;
          }
        });
        col.width = Math.min(35, Math.max(maxLen + 4, 14));
      });

      // Write to buffer and trigger browser download
      const buffer = await workbook.xlsx.writeBuffer();
      const cleanMonthLabel = monthLabel.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Salary_Report_${cleanMonthLabel}.xlsx`;

      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Downloaded ${fileName}! 📊`);
    } catch (error) {
      console.error('Excel Export Error:', error);
      toast.error('Failed to export Excel sheet');
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

    const base = p.baseSalary || 0;
    const pf = p.pfDeduction !== undefined ? p.pfDeduction : Math.round(base * 0.12);
    const medi = p.mediclaimDeduction !== undefined ? p.mediclaimDeduction : (base > 0 ? 1000 : 0);
    const leave = p.leaveDeduction !== undefined ? p.leaveDeduction : (p.deductions || 0);

    doc.autoTable({
      startY: 95,
      head: [['Component', 'Amount (₹)']],
      body: [
        ['Base Salary', `₹${base.toLocaleString()}`],
        ['Bonus', `₹${(p.bonus || 0).toLocaleString()}`],
        ['Mediclaim Deduction', `- ₹${medi.toLocaleString()}`],
        ['PF Deduction', `- ₹${pf.toLocaleString()}`],
        ['Leave & Attendance Deductions', `- ₹${leave.toLocaleString()}`],
        ['Total Deductions', `- ₹${(p.deductions || (pf + medi + leave)).toLocaleString()}`],
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

  const totalPayroll = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

  return (
    <div className="space-y-6 animate-fade-in">
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
            <button
              onClick={() => handleDownloadExcel(selectedMonthYear)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 text-sm"
              title="Download Excel Sheet for Selected Month"
            >
              📊 Download Excel
            </button>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-100">
              Payroll Records — {viewMonthYear}
            </h2>
            <p className="text-sm text-surface-500 mt-1">
              Total: <strong className="text-primary-400">₹{totalPayroll.toLocaleString()}</strong> ({payrolls.length} employees)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={viewMonthYear}
              onChange={(e) => setViewMonthYear(e.target.value)}
              className="select-field w-auto"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={() => handleDownloadExcel(viewMonthYear)}
              className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-semibold rounded-lg transition-all flex items-center gap-2 text-xs"
              title="Download Excel for currently viewed month"
            >
              📊 Download Excel
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Base Salary</th>
                <th>Bonus</th>
                <th>Mediclaim</th>
                <th>PF (12%)</th>
                <th>Leave / Late</th>
                <th>Total Deductions</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-surface-500">Loading...</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-surface-500">No payroll records for this month</td></tr>
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
                          <p className="text-xs text-surface-500">{p.employeeId?.designation || p.employeeId?.department || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-surface-300 font-mono">₹{p.baseSalary.toLocaleString()}</td>
                    <td className="text-emerald-400 font-mono">+₹{p.bonus.toLocaleString()}</td>
                    <td className="text-amber-400/90 font-mono">-₹{(p.mediclaimDeduction || 0).toLocaleString()}</td>
                    <td className="text-amber-400/90 font-mono">-₹{(p.pfDeduction || 0).toLocaleString()}</td>
                    <td className="text-rose-400/90 font-mono">-₹{(p.leaveDeduction || 0).toLocaleString()}</td>
                    <td className="text-rose-400 font-semibold font-mono">-₹{p.deductions.toLocaleString()}</td>
                    <td className="font-bold text-primary-400 font-mono">₹{p.netSalary.toLocaleString()}</td>
                    <td>
                      {isAdmin ? (
                        <select
                          value={p.status || 'Unpaid'}
                          onChange={(e) => handleStatusChange(p._id, e.target.value)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border outline-none cursor-pointer transition-all ${
                            p.status === 'Paid'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : p.status === 'Pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          <option value="Paid" className="bg-surface-900 text-emerald-400">Paid</option>
                          <option value="Unpaid" className="bg-surface-900 text-rose-400">Unpaid</option>
                          <option value="Pending" className="bg-surface-900 text-amber-400">Pending</option>
                        </select>
                      ) : (
                        <span className={p.status === 'Paid' ? 'badge-paid' : p.status === 'Pending' ? 'badge' : 'badge-unpaid'}>
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadPayslip(p)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-700/50 text-surface-300 hover:bg-surface-600/50 border border-surface-600/50 transition-colors flex items-center gap-1"
                        >
                          📄 PDF
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

import { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';
import UserAvatar from '../../components/common/UserAvatar';

const GeneratePayroll = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [selectedMonthYear, setSelectedMonthYear] = useState('');
  const [viewMonthYear, setViewMonthYear] = useState('');

  // Generation Mode: 'all' (bulk) or 'single' (individual employee)
  const [generationMode, setGenerationMode] = useState('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  useEffect(() => {
    // Default to current month
    const now = new Date();
    const current = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    setSelectedMonthYear(current);
    setViewMonthYear(current);

    // Fetch employee directory for single generation and bank lookups
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (viewMonthYear) fetchPayrolls();
  }, [viewMonthYear]);

  const fetchEmployees = async () => {
    try {
      const { data } = await API.get('/auth/employees');
      // Filter out admins (only employees eligible for payroll)
      const nonAdmins = Array.isArray(data) ? data.filter((e) => e.role !== 'Admin') : [];
      setEmployees(nonAdmins);
      if (nonAdmins.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(nonAdmins[0]._id);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

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

  /**
   * Generates payroll either in bulk for all employees, or for a specific employee.
   * @param {string|null} overrideEmployeeId - If provided, generates for this single employee.
   */
  const handleGenerate = async (overrideEmployeeId = null) => {
    const targetMonth = selectedMonthYear || viewMonthYear;
    if (!targetMonth) {
      toast.error('Please select a month');
      return;
    }

    const isSingle = overrideEmployeeId !== null || (generationMode === 'single' && selectedEmployeeId);
    const targetEmpId = overrideEmployeeId || (generationMode === 'single' ? selectedEmployeeId : null);

    if (targetEmpId) {
      setGeneratingId(targetEmpId);
    } else {
      setGenerating(true);
    }

    try {
      const payload = { monthYear: targetMonth };
      if (targetEmpId) {
        payload.employeeId = targetEmpId;
      }

      const { data } = await API.post('/payroll/generate', payload);
      toast.success(data.message || 'Payroll processed successfully! ✅');
      setViewMonthYear(targetMonth);
      fetchPayrolls();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Payroll generation failed');
    } finally {
      setGenerating(false);
      setGeneratingId(null);
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

  // Generate monthYear options for the dropdowns
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const label = d.toLocaleString('en', { month: 'long', year: 'numeric' });
    monthOptions.push({ value: val, label });
  }

  /**
   * Helper to extract complete, fresh bank details directly from employee profile.
   * Cross-references the active `employees` list if the payroll populated object is partial.
   */
  const getEmployeeBank = (empObjOrId) => {
    const id = typeof empObjOrId === 'object' ? empObjOrId?._id : empObjOrId;
    const fullEmp = employees.find((e) => String(e._id) === String(id));
    const empObj = typeof empObjOrId === 'object' && empObjOrId !== null ? empObjOrId : (fullEmp || {});

    const directBank = empObj?.bankDetails || {};
    const profileBank = fullEmp?.bankDetails || {};
    // Prioritize whichever object has populated account number or bank name
    const bank = (profileBank.accountNumber || profileBank.bankName) ? profileBank : directBank;

    return {
      bankName: bank.bankName ? bank.bankName.trim() : '',
      branchName: bank.branchName ? bank.branchName.trim() : '',
      ifscCode: bank.ifscCode ? bank.ifscCode.toUpperCase().trim() : '',
      accountNumber: bank.accountNumber ? String(bank.accountNumber).trim() : '',
      accountHolderName: bank.accountHolderName
        ? bank.accountHolderName.trim()
        : (empObj.name || fullEmp?.name || '').trim(),
      bankAddress: bank.bankAddress ? bank.bankAddress.trim() : '',
      fullEmp: fullEmp || empObj,
    };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FINANCE BANK TRANSFER & SALARY DISBURSEMENT PDF REPORT (LANDSCAPE)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDownloadBankTransferPDF = async (monthYearToExport) => {
    setDownloadingPdf(true);
    try {
      let recordsToExport = payrolls;
      if (monthYearToExport !== viewMonthYear || payrolls.length === 0) {
        const { data } = await API.get(`/payroll/all?monthYear=${monthYearToExport}`);
        recordsToExport = data;
      }

      if (!recordsToExport || recordsToExport.length === 0) {
        toast.error(`No payroll data found for ${monthYearToExport}. Please generate payroll first.`);
        setDownloadingPdf(false);
        return;
      }

      const monthObj = monthOptions.find((m) => m.value === monthYearToExport);
      const monthLabel = monthObj ? monthObj.label : monthYearToExport;

      // Initialize Landscape A4 (297mm x 210mm)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // ── Top Company & Advice Banner (Deep Teal Brand) ──────────────────────────
      doc.setFillColor(8, 37, 43); // brand deep teal
      doc.rect(0, 0, 297, 26, 'F');

      // Accent color stripe
      doc.setFillColor(20, 184, 166); // teal-500
      doc.rect(0, 25, 297, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14.5);
      doc.text('EMPLOYEE TRACKER ENTERPRISE HRMS', 14, 11);

      doc.setFontSize(10);
      doc.setTextColor(204, 251, 241); // teal-100
      doc.text(`MONTHLY SALARY DISBURSEMENT & BANK TRANSFER ADVICE — ${monthLabel.toUpperCase()}`, 14, 19);

      // Top Right metadata
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 283, 11, { align: 'right' });
      doc.text(`Target Period: ${monthYearToExport} | Confidential Financial Advice`, 283, 18, { align: 'right' });

      // ── Calculate Totals ─────────────────────────────────────────────────────
      let totalBase = 0;
      let totalBonus = 0;
      let totalMedi = 0;
      let totalPF = 0;
      let totalOtherPenalties = 0;
      let totalDeductions = 0;
      let totalNetPayable = 0;

      recordsToExport.forEach((p) => {
        totalBase += (p.baseSalary || 0);
        totalBonus += (p.bonus || 0);
        totalMedi += (p.mediclaimDeduction || 0);
        totalPF += (p.pfDeduction || 0);
        const specificPenalties = (p.deductions || 0) - (p.pfDeduction || 0) - (p.mediclaimDeduction || 0);
        totalOtherPenalties += Math.max(0, specificPenalties);
        totalDeductions += (p.deductions || 0);
        totalNetPayable += (p.netSalary || 0);
      });

      // ── Summary Metrics Bar (y: 29 to 46) ────────────────────────────────────
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(14, 29, 269, 17, 2, 2, 'FD');

      // Metric Items in summary box
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('TOTAL BENEFICIARIES', 20, 34);
      doc.text('TOTAL BASE SALARY', 58, 34);
      doc.text('TOTAL BONUS', 100, 34);
      doc.text('TOTAL MEDICLAIM', 135, 34);
      doc.text('TOTAL PF (12%)', 174, 34);
      doc.text('TOTAL DEDUCTIONS', 211, 34);
      doc.text('NET DISBURSEMENT', 252, 34);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${recordsToExport.length} Employees`, 20, 42);
      doc.text(`₹${totalBase.toLocaleString()}`, 58, 42);
      doc.setTextColor(16, 185, 129); // emerald-600
      doc.text(`+₹${totalBonus.toLocaleString()}`, 100, 42);
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`-₹${totalMedi.toLocaleString()}`, 135, 42);
      doc.text(`-₹${totalPF.toLocaleString()}`, 174, 42);
      doc.text(`-₹${totalDeductions.toLocaleString()}`, 211, 42);
      doc.setTextColor(15, 118, 110); // brand deep teal
      doc.setFontSize(10.5);
      doc.text(`₹${totalNetPayable.toLocaleString()}`, 252, 42);

      // ── Populate AutoTable with Financial & Bank Details Extracted from Profile ──
      const tableHeaders = [
        '#',
        'Emp Code',
        'Beneficiary (Account Holder)',
        'Bank Name & Branch',
        'Account Number',
        'IFSC Code',
        'Base (₹)',
        'Bonus (₹)',
        'Medi. (₹)',
        'PF (₹)',
        'Other (₹)',
        'Total Ded. (₹)',
        'Net Payable (₹)',
        'Status',
      ];

      const tableRows = recordsToExport.map((p, idx) => {
        const bankData = getEmployeeBank(p.employeeId);
        const emp = bankData.fullEmp || p.employeeId || {};
        const otherPenalties = Math.max(0, (p.deductions || 0) - (p.pfDeduction || 0) - (p.mediclaimDeduction || 0));

        const bankNameDisplay = bankData.bankName
          ? (bankData.branchName ? `${bankData.bankName} (${bankData.branchName})` : bankData.bankName)
          : 'Not Provided';

        return [
          idx + 1,
          emp.employeeCode || '—',
          bankData.accountHolderName || emp.name || '—',
          bankNameDisplay,
          bankData.accountNumber || 'Not Provided',
          bankData.ifscCode || 'Not Provided',
          (p.baseSalary || 0).toLocaleString(),
          (p.bonus || 0).toLocaleString(),
          (p.mediclaimDeduction || 0).toLocaleString(),
          (p.pfDeduction || 0).toLocaleString(),
          otherPenalties.toLocaleString(),
          (p.deductions || 0).toLocaleString(),
          (p.netSalary || 0).toLocaleString(),
          p.status || 'Unpaid',
        ];
      });

      // Totals Footer Row
      const tableFooters = [
        [
          'TOTAL',
          '',
          `${recordsToExport.length} Emps`,
          '',
          '',
          '',
          `₹${totalBase.toLocaleString()}`,
          `₹${totalBonus.toLocaleString()}`,
          `₹${totalMedi.toLocaleString()}`,
          `₹${totalPF.toLocaleString()}`,
          `₹${totalOtherPenalties.toLocaleString()}`,
          `₹${totalDeductions.toLocaleString()}`,
          `₹${totalNetPayable.toLocaleString()}`,
          '',
        ],
      ];

      doc.autoTable({
        startY: 49,
        head: [tableHeaders],
        body: tableRows,
        foot: tableFooters,
        theme: 'grid',
        margin: { left: 10, right: 10 },
        headStyles: {
          fillColor: [14, 75, 86], // Brand Deep Teal
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 2.5,
        },
        bodyStyles: {
          fontSize: 7.2,
          textColor: [15, 23, 42],
          cellPadding: 2.2,
        },
        footStyles: {
          fillColor: [240, 253, 250],
          textColor: [8, 37, 43],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 2.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },   // #
          1: { halign: 'center', cellWidth: 18 },  // Code
          2: { halign: 'left', cellWidth: 32 },    // Beneficiary
          3: { halign: 'left', cellWidth: 36 },    // Bank Name & Branch
          4: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },  // Account Number
          5: { halign: 'center', cellWidth: 22 },  // IFSC Code
          6: { halign: 'right', cellWidth: 17 },   // Base
          7: { halign: 'right', cellWidth: 16 },   // Bonus
          8: { halign: 'right', cellWidth: 15 },   // Medi
          9: { halign: 'right', cellWidth: 15 },   // PF
          10: { halign: 'right', cellWidth: 15 },  // Other
          11: { halign: 'right', cellWidth: 18 },  // Total Ded
          12: { halign: 'right', fontStyle: 'bold', textColor: [15, 118, 110], cellWidth: 22 }, // Net Payable
          13: { halign: 'center', cellWidth: 13 }, // Status
        },
      });

      // ── Finance Sign-off Section (Placed at bottom of document) ───────────────
      let finalY = doc.lastAutoTable?.finalY || 140;
      if (finalY > 165) {
        doc.addPage();
        finalY = 16;
      } else {
        finalY += 8;
      }

      // Finance Instruction Box
      doc.setFillColor(240, 253, 250); // teal-50
      doc.setDrawColor(153, 246, 228); // teal-200
      doc.roundedRect(10, finalY, 277, 12, 1.5, 1.5, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(19, 78, 74); // teal-900
      doc.setFont('helvetica', 'bold');
      doc.text('DIRECTIVE FOR FINANCE & DISBURSEMENT TEAM:', 14, finalY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 118, 110); // teal-700
      doc.text(
        'Please execute electronic salary transfers (NEFT / RTGS / IMPS) to the verified employee bank accounts listed above for the net payable amounts. Employee profile bank records have been cross-verified. Statutory contributions (PF & Mediclaim) have been credited to corporate fund trusts.',
        14,
        finalY + 8.5
      );

      finalY += 16;

      // 3 Authorization Blocks
      const boxWidth = 87;
      const boxHeight = 22;

      // Box 1: Prepared By
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(10, finalY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('PREPARED BY (HR / PAYROLL SPECIALIST)', 14, finalY + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('Signature: __________________________', 14, finalY + 13);
      doc.text('Date: ____ / ____ / 2026', 14, finalY + 19);

      // Box 2: Verified By
      doc.roundedRect(105, finalY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.text('VERIFIED BY (FINANCE / ACCOUNTS MANAGER)', 109, finalY + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('Signature: __________________________', 109, finalY + 13);
      doc.text('Date: ____ / ____ / 2026', 109, finalY + 19);

      // Box 3: Approved By
      doc.roundedRect(200, finalY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.text('APPROVED BY (MANAGING DIRECTOR / CFO)', 204, finalY + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('Signature: __________________________', 204, finalY + 13);
      doc.text('Date: ____ / ____ / 2026', 204, finalY + 19);

      // Save Document
      const cleanLabel = monthLabel.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Salary_Bank_Transfer_Advice_${cleanLabel}.pdf`);
      toast.success('Finance Bank Transfer PDF downloaded successfully! 📄');
    } catch (error) {
      console.error('Bank Transfer PDF Export Error:', error);
      toast.error('Failed to export Finance PDF report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. EXCEL DOWNLOAD (EXISTING COMPREHENSIVE EXPORT)
  // ─────────────────────────────────────────────────────────────────────────────
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

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Employee Tracker HR System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Salary Report', {
        views: [{ showGridLines: true }],
      });

      // Title Banner
      worksheet.mergeCells('A1:T1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `MONTHLY SALARY PAYROLL REPORT — ${monthLabel.toUpperCase()}`;
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF08252B' }, // Brand Deep Teal
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 42;

      // Meta Row
      worksheet.mergeCells('A2:T2');
      const metaCell = worksheet.getCell('A2');
      metaCell.value = `Generated Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  |  Total Employees: ${recordsToExport.length}  |  Confidential Financial Payroll Advice`;
      metaCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
      metaCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF134E4A' },
      };
      metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 24;

      worksheet.getRow(3).height = 12;

      // Headers (With Bank Account Details for Finance Disbursement)
      const headers = [
        'Employee Name',
        'Employee Code',
        'Mediclaim ID',
        'PF ID',
        'Role',
        'Designation',
        'Month of Salary',
        'Base Salary (₹)',
        'Days Worked',
        'Bonus (₹)',
        'Mediclaim Deduction (₹)',
        'PF Deduction (₹)',
        'Leave & Attendance Deductions (₹)',
        'Total Deductions (₹)',
        'Net Salary (₹)',
        'Bank Name & Branch',
        'Account Number',
        'Account Holder Name',
        'IFSC Code',
        'Status',
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.values = headers;
      headerRow.height = 30;

      headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0E4B56' }, // Brand Deep Teal
        };
        cell.alignment = {
          horizontal: colNumber >= 8 && colNumber <= 15 && colNumber !== 9 ? 'right' : 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF08252B' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF08252B' } },
          right: { style: 'thin', color: { argb: 'FF475569' } },
        };
      });

      let totalBase = 0;
      let totalBonus = 0;
      let totalMedi = 0;
      let totalPF = 0;
      let totalLeave = 0;
      let totalDed = 0;
      let totalNet = 0;

      recordsToExport.forEach((p, idx) => {
        const bankData = getEmployeeBank(p.employeeId);
        const emp = bankData.fullEmp || p.employeeId || {};
        const bank = bankData;
        const base = p.baseSalary || 0;
        const net = p.netSalary || 0;
        const daysWorked = p.effectiveDays && p.totalDaysInMonth ? `${p.effectiveDays} / ${p.totalDaysInMonth}` : '—';

        totalBase += base;
        totalBonus += p.bonus || 0;
        totalMedi += p.mediclaimDeduction || 0;
        totalPF += p.pfDeduction || 0;
        totalLeave += p.leaveDeduction || 0;
        totalDed += p.deductions || 0;
        totalNet += net;

        const rowIndex = idx + 5;
        const row = worksheet.getRow(rowIndex);
        row.height = 26;

        const bankNameDisplay = bank.bankName
          ? (bank.branchName ? `${bank.bankName} (${bank.branchName})` : bank.bankName)
          : '—';

        row.values = [
          emp.name || '—',
          emp.employeeCode || '—',
          emp.mediclaimId || 'Not Assigned',
          emp.pfId || 'Not Assigned',
          emp.role || '—',
          emp.designation || '—',
          monthLabel,
          base,
          daysWorked,
          p.bonus || 0,
          p.mediclaimDeduction || 0,
          p.pfDeduction || 0,
          p.leaveDeduction || 0,
          p.deductions || 0,
          net,
          bankNameDisplay,
          bank.accountNumber || '—',
          bank.accountHolderName || emp.name || '—',
          bank.ifscCode || '—',
          p.status || 'Unpaid',
        ];

        const isEven = idx % 2 === 0;
        const bgFill = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgFill },
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };

          if (colNumber >= 8 && colNumber <= 15 && colNumber !== 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '₹#,##0';
          } else {
            cell.alignment = { horizontal: colNumber === 9 ? 'center' : 'left', vertical: 'middle' };
          }

          if (colNumber === 14) {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          }

          if (colNumber === 15) {
            cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF065F46' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          }
        });
      });

      // Summary Row
      const summaryRowIndex = recordsToExport.length + 5;
      const summaryRow = worksheet.getRow(summaryRowIndex);
      summaryRow.height = 28;

      worksheet.mergeCells(`A${summaryRowIndex}:G${summaryRowIndex}`);
      const sumLabelCell = worksheet.getCell(`A${summaryRowIndex}`);
      sumLabelCell.value = 'TOTAL PAYROLL SUMMARY';
      sumLabelCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      sumLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08252B' } };
      sumLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

      summaryRow.getCell(8).value = totalBase;
      summaryRow.getCell(10).value = totalBonus;
      summaryRow.getCell(11).value = totalMedi;
      summaryRow.getCell(12).value = totalPF;
      summaryRow.getCell(13).value = totalLeave;
      summaryRow.getCell(14).value = totalDed;
      summaryRow.getCell(15).value = totalNet;

      for (let c = 8; c <= 20; c++) {
        const cell = summaryRow.getCell(c);
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08252B' } };
        cell.alignment = { horizontal: c >= 8 && c <= 15 && c !== 9 ? 'right' : 'center', vertical: 'middle' };
        if (c >= 8 && c <= 15 && c !== 9) cell.numFmt = '₹#,##0';
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF475569' } },
          bottom: { style: 'double', color: { argb: 'FFFFFFFF' } },
        };
      }

      worksheet.columns.forEach((col) => {
        let maxLen = 14;
        col.eachCell({ includeEmpty: false }, (cell, rowIdx) => {
          if (rowIdx > 3 && cell.value) {
            const len = String(cell.value).length;
            if (len > maxLen) maxLen = len;
          }
        });
        col.width = Math.min(35, Math.max(maxLen + 4, 14));
      });

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

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. INDIVIDUAL PAYSLIP PDF DOWNLOAD (SINGLE EMPLOYEE)
  // ─────────────────────────────────────────────────────────────────────────────
  const downloadPayslip = (p) => {
    const doc = new jsPDF();
    const bank = getEmployeeBank(p.employeeId);
    const emp = bank.fullEmp || p.employeeId || {};

    // ── Header Banner (Deep Teal Brand) ──
    doc.setFillColor(8, 37, 43); // brand deep teal
    doc.rect(0, 0, 210, 38, 'F');
    doc.setFillColor(20, 184, 166); // teal accent line
    doc.rect(0, 36.5, 210, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE SALARY PAYSLIP', 105, 16, { align: 'center' });
    doc.setFontSize(9.5);
    doc.setTextColor(204, 251, 241);
    doc.text(`CONFIDENTIAL SALARY STATEMENT — ${p.monthYear}`, 105, 24, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(153, 246, 228);
    doc.text('Employee Tracker Enterprise HRMS Platform', 105, 30, { align: 'center' });

    // ── Two Column Employee & Bank Overview Box ──
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 43, 182, 54, 2, 2, 'FD');

    // Left Column: Employee Information
    doc.setTextColor(8, 37, 43);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE INFORMATION', 20, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Name:', 20, 57);
    doc.text('Emp Code:', 20, 63);
    doc.text('Department:', 20, 69);
    doc.text('Designation:', 20, 75);
    doc.text('Corporate Email:', 20, 81);
    doc.text('Contact Phone:', 20, 87);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${emp.name || '-'}`, 48, 57);
    doc.text(`${emp.employeeCode || '-'}`, 48, 63);
    doc.setFont('helvetica', 'normal');
    doc.text(`${emp.department || '-'}`, 48, 69);
    doc.text(`${emp.designation || '-'}`, 48, 75);
    doc.text(`${emp.email || '-'}`, 48, 81);
    doc.text(`${emp.phone || '-'}`, 48, 87);

    // Right Column: Bank & Disbursement Details
    doc.setTextColor(8, 37, 43);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BANK DISBURSEMENT DETAILS', 108, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Bank Name:', 108, 57);
    doc.text('Branch:', 108, 63);
    doc.text('Beneficiary:', 108, 69);
    doc.text('Account No:', 108, 75);
    doc.text('IFSC Code:', 108, 81);
    doc.text('Statutory IDs:', 108, 87);

    doc.setTextColor(15, 23, 42);
    const bankBranchStr = bank.branchName || 'Main Branch';
    doc.text(`${bank.bankName || 'Not Provided'}`, 134, 57);
    doc.text(`${bankBranchStr}`, 134, 63);
    doc.text(`${bank.accountHolderName || emp.name || '-'}`, 134, 69);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    const maskedAcc = bank.accountNumber
      ? (bank.accountNumber.length > 4 ? `••••••••${bank.accountNumber.slice(-4)} (${bank.accountNumber})` : bank.accountNumber)
      : 'Not Provided';
    doc.text(`${maskedAcc}`, 134, 75);

    doc.setTextColor(15, 23, 42);
    doc.text(`${bank.ifscCode || 'Not Provided'}`, 134, 81);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`PF: ${emp.pfId || 'N/A'} | MED: ${emp.mediclaimId || 'N/A'}`, 134, 87);

    const deductionRows = [
      ['Provident Fund (PF - 12%)', `- ₹${(p.pfDeduction || 0).toLocaleString()}`],
      ['Mediclaim Health Fund', `- ₹${(p.mediclaimDeduction || 0).toLocaleString()}`],
    ];

    if (p.inactiveDeduction > 0 || p.inactiveCount >= 155) {
      deductionRows.push([
        `Inactivity Penalty (≥155 times, ${p.inactiveCount || 0} counts - 1%)`,
        `- ₹${(p.inactiveDeduction || 0).toLocaleString()}`,
      ]);
    }

    if (p.unapprovedAbsenceDeduction > 0 || p.yearlyUnapprovedAbsences >= 5) {
      deductionRows.push([
        `Unapproved Absence Penalty (≥5/yr, ${p.yearlyUnapprovedAbsences || 0} days - 1%)`,
        `- ₹${(p.unapprovedAbsenceDeduction || 0).toLocaleString()}`,
      ]);
    }

    if (p.postAbsenceApprovedDeduction > 0 || p.postAbsenceApprovedLeaves > 0) {
      deductionRows.push([
        `Post-Absence Approved Leave Penalty (${p.postAbsenceApprovedLeaves || 0} leave - 0.5%)`,
        `- ₹${(p.postAbsenceApprovedDeduction || 0).toLocaleString()}`,
      ]);
    }

    if (p.postAbsenceRejectedDeduction > 0 || p.postAbsenceRejectedLeaves > 0) {
      deductionRows.push([
        `Post-Absence Rejected Leave Penalty (${p.postAbsenceRejectedLeaves || 0} leave - 1%)`,
        `- ₹${(p.postAbsenceRejectedDeduction || 0).toLocaleString()}`,
      ]);
    }

    const specificPenalties =
      (p.inactiveDeduction || 0) +
      (p.unapprovedAbsenceDeduction || 0) +
      (p.postAbsenceApprovedDeduction || 0) +
      (p.postAbsenceRejectedDeduction || 0);
    const otherLeaveDeductions = (p.leaveDeduction || 0) - specificPenalties;
    if (otherLeaveDeductions > 0) {
      deductionRows.push(['Other Leave / Unpaid Deductions', `- ₹${otherLeaveDeductions.toLocaleString()}`]);
    }

    const tableBody = [
      ['Base Salary', `₹${(p.baseSalary || 0).toLocaleString()}`],
      ['Bonus', p.bonus > 0 ? `+ ₹${p.bonus.toLocaleString()} ${p.bonusReason ? `(${p.bonusReason})` : ''}` : '₹0'],
      ['Total Deductions (Itemized Below)', `- ₹${(p.deductions || 0).toLocaleString()}`],
      ...deductionRows,
      ['', ''],
      ['Net Salary (Take-Home Disbursement)', `₹${(p.netSalary || 0).toLocaleString()}`],
    ];

    doc.autoTable({
      startY: 103,
      head: [['Salary Component', 'Disbursement / Deduction Amount (₹)']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [14, 75, 86], fontSize: 9.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: [15, 23, 42] },
      styles: { cellPadding: 5.5 },
      didParseCell: function (data) {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 118, 110];
          data.cell.styles.fillColor = [240, 253, 250];
        }
      },
    });

    const finalY = (doc.lastAutoTable?.finalY || 160) + 8;
    if (p.deductionBreakdownNotes && p.deductionBreakdownNotes.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Deduction & Attendance Penalty Notes:', 14, finalY);
      p.deductionBreakdownNotes.forEach((note, idx) => {
        doc.text(`• ${note}`, 16, finalY + 5 + idx * 4.5);
      });
    }

    // Footnote & System Stamp
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'This is an electronically generated salary advice with verified bank payout details. Direct deposit transferred securely.',
      105,
      285,
      { align: 'center' }
    );

    doc.save(`Payslip_${emp.name || 'employee'}_${p.monthYear}.pdf`);
    toast.success('Payslip PDF downloaded! 📄');
  };

  const totalPayroll = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

  // Map existing payroll records by employee ID for fast lookup
  const payrollsByEmpId = {};
  payrolls.forEach((p) => {
    if (p.employeeId?._id) {
      payrollsByEmpId[p.employeeId._id] = p;
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title & Schedule Notification Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-100">
            {isAdmin ? 'Generate & Manage Payroll' : 'Payroll Records'}
          </h1>
          <p className="text-surface-400 mt-1 text-sm">
            {isAdmin
              ? 'Automatic month-end deductions, individual employee generation, and finance bank transfer schedules'
              : 'View monthly salary records and download payslips'}
          </p>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleDownloadBankTransferPDF(viewMonthYear)}
            disabled={downloadingPdf || payrolls.length === 0}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2 text-sm"
            title="Download Bank Transfer PDF for Finance Team"
          >
            {downloadingPdf ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              '📄'
            )}
            Download Bank Transfer PDF (Finance Report)
          </button>

          <button
            onClick={() => handleDownloadExcel(viewMonthYear)}
            disabled={payrolls.length === 0}
            className="px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 font-semibold rounded-xl transition-all flex items-center gap-2 text-sm"
            title="Download Excel Sheet"
          >
            📊 Excel
          </button>
        </div>
      </div>

      {/* Automated Deduction Schedule Information Banner */}
      <div className="bg-teal-950/40 border border-teal-500/30 rounded-2xl p-4 flex items-start gap-3.5 text-sm text-teal-200">
        <span className="text-2xl leading-none">⏰</span>
        <div className="flex-1">
          <p className="font-semibold text-teal-100">
            Automated Monthly Statutory Deductions Active (2nd of Every Month at 00:05 AM IST)
          </p>
          <p className="text-xs text-teal-300/90 mt-1 leading-relaxed">
            The background scheduler automatically calculates PF &amp; Mediclaim deductions, evaluates 5 enterprise
            attendance/disciplinary rules, deposits funds into employee accounts, generates monthly payslips, and dispatches email advice to all employees on the 2nd of each month.
          </p>
        </div>
      </div>

      {/* Generate Card — Admin only */}
      {isAdmin && (
        <div className="glass-card p-6 border border-surface-700/60 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-surface-800 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                <span>💰</span> Process &amp; Generate Payroll
              </h2>
              <p className="text-xs text-surface-400 mt-0.5">
                Choose between Bulk Automatic Generation for all employees, or Individual Manual Generation for a single employee.
              </p>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex items-center bg-surface-900/80 p-1 rounded-xl border border-surface-700/60 text-xs">
              <button
                type="button"
                onClick={() => setGenerationMode('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  generationMode === 'all'
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                ⚡ Bulk (All Employees)
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('single')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  generationMode === 'single'
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'text-surface-400 hover:text-surface-200'
                }`}
              >
                👤 Single Employee (Manual)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {/* Month Selector */}
            <div>
              <label className="block text-xs font-medium text-surface-400 mb-1.5">Target Month</label>
              <select
                value={selectedMonthYear}
                onChange={(e) => setSelectedMonthYear(e.target.value)}
                className="select-field w-auto text-sm"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* If Single Employee Mode: Employee Dropdown */}
            {generationMode === 'single' && (
              <div className="min-w-[240px]">
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Select Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="select-field w-full text-sm"
                >
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name} ({emp.employeeCode || 'EMP'}) — ₹{(emp.basicSalary || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              onClick={() => handleGenerate(null)}
              disabled={generating || (generationMode === 'single' && !selectedEmployeeId)}
              className="btn-primary flex items-center gap-2 py-2.5 px-5 font-semibold text-sm"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating Payroll...
                </>
              ) : generationMode === 'all' ? (
                <>
                  <span>⚡</span> Generate All Payslips (Auto Bulk)
                </>
              ) : (
                <>
                  <span>👤</span> Generate for Selected Employee
                </>
              )}
            </button>

            {/* Download Bank Transfer PDF */}
            <button
              onClick={() => handleDownloadBankTransferPDF(selectedMonthYear)}
              disabled={downloadingPdf}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-teal-900/25 transition-all flex items-center gap-2 text-sm"
              title="Download Bank Transfer PDF for Finance Team"
            >
              {downloadingPdf ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                '📄'
              )}
              Download Bank Transfer PDF
            </button>

            {/* Download Excel */}
            <button
              onClick={() => handleDownloadExcel(selectedMonthYear)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 text-sm"
              title="Download Excel Sheet for Selected Month"
            >
              📊 Download Excel
            </button>
          </div>
        </div>
      )}

      {/* Payroll Table Container */}
      <div className="glass-card p-6 border border-surface-700/60 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
              <span>📋</span> Payroll Records — {viewMonthYear}
            </h2>
            <p className="text-sm text-surface-400 mt-1">
              Total Net Salary: <strong className="text-primary-400 font-mono">₹{totalPayroll.toLocaleString()}</strong> ({payrolls.length} payslips generated)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={viewMonthYear}
              onChange={(e) => setViewMonthYear(e.target.value)}
              className="select-field w-auto text-sm"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <button
              onClick={() => handleDownloadBankTransferPDF(viewMonthYear)}
              className="px-3.5 py-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 font-semibold rounded-xl transition-all flex items-center gap-1.5 text-xs"
              title="Download Bank Transfer PDF for viewed month"
            >
              📄 Bank Transfer PDF
            </button>

            <button
              onClick={() => handleDownloadExcel(viewMonthYear)}
              className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-semibold rounded-xl transition-all flex items-center gap-1.5 text-xs"
              title="Download Excel for currently viewed month"
            >
              📊 Excel
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
                <th>Leave / Penalty</th>
                <th>Total Ded.</th>
                <th>Net Salary</th>
                <th>Bank Info</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-surface-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                      Loading payroll records...
                    </div>
                  </td>
                </tr>
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-surface-500">
                    <p className="text-base font-semibold text-surface-300">No payroll records generated yet for {viewMonthYear}</p>
                    {isAdmin && (
                      <p className="text-xs text-surface-400 mt-2">
                        Click <strong className="text-primary-400">"Generate All Payslips"</strong> above or generate individually for any employee.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                payrolls.map((p) => {
                  const bank = getEmployeeBank(p.employeeId);
                  const emp = bank.fullEmp || p.employeeId || {};
                  const isThisGenerating = generatingId === emp._id;

                  return (
                    <tr key={p._id}>
                      {/* Employee details */}
                      <td>
                        <div className="flex items-center gap-3">
                          <UserAvatar user={emp} size="sm" />
                          <div>
                            <p className="font-medium text-surface-200">
                              {emp.name || 'Unknown'}{' '}
                              {emp.employeeCode && (
                                <span className="text-xs font-mono text-surface-400 ml-1">
                                  ({emp.employeeCode})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-surface-500">
                              {emp.designation || emp.department || 'Employee'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Base Salary */}
                      <td className="text-surface-300 font-mono font-medium">
                        ₹{(p.baseSalary || 0).toLocaleString()}
                      </td>

                      {/* Bonus */}
                      <td className="text-emerald-400 font-mono">
                        <div>+₹{(p.bonus || 0).toLocaleString()}</div>
                        {p.bonusReason && (
                          <div className="text-[10px] text-amber-300 font-sans tracking-tight">
                            {p.bonusReason}
                          </div>
                        )}
                      </td>

                      {/* Mediclaim */}
                      <td className="text-rose-400/90 font-mono font-medium">
                        -₹{(p.mediclaimDeduction || 0).toLocaleString()}
                      </td>

                      {/* PF */}
                      <td className="text-rose-400/90 font-mono font-medium">
                        -₹{(p.pfDeduction || 0).toLocaleString()}
                      </td>

                      {/* Leave & Penalties */}
                      <td className="text-amber-400/90 font-mono">
                        <div>-₹{(p.leaveDeduction || 0).toLocaleString()}</div>
                        {p.deductionBreakdownNotes && p.deductionBreakdownNotes.length > 0 && (
                          <div
                            className="text-[10px] text-amber-300 font-sans tracking-tight cursor-help"
                            title={p.deductionBreakdownNotes.join('\n')}
                          >
                            ⚠️ {p.deductionBreakdownNotes.length} penalty note(s)
                          </div>
                        )}
                      </td>

                      {/* Total Deductions */}
                      <td className="text-rose-400 font-semibold font-mono">
                        -₹{(p.deductions || 0).toLocaleString()}
                      </td>

                      {/* Net Take-Home Salary */}
                      <td className="font-bold text-primary-400 font-mono text-sm">
                        ₹{(p.netSalary || 0).toLocaleString()}
                      </td>

                      {/* Bank Details */}
                      <td className="text-xs text-surface-400 font-mono">
                        {bank.accountNumber ? (
                          <div title={`Bank: ${bank.bankName || 'N/A'}\nBranch: ${bank.branchName || 'N/A'}\nBeneficiary: ${bank.accountHolderName || 'N/A'}\nIFSC: ${bank.ifscCode || 'N/A'}\nAccount No: ${bank.accountNumber}`}>
                            <div className="text-surface-300 font-medium">{bank.bankName || 'Bank'}</div>
                            <div className="text-[11px] text-surface-500 font-mono">•••• {bank.accountNumber.slice(-4)}</div>
                            {bank.ifscCode && (
                              <div className="text-[10px] text-teal-400 font-mono">{bank.ifscCode}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-600 italic">No Bank Info</span>
                        )}
                      </td>

                      {/* Status */}
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

                      {/* Actions: Download Payslip + Single Recalculate */}
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadPayslip(p)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-surface-700/50 text-surface-300 hover:bg-surface-600/50 border border-surface-600/50 transition-colors flex items-center gap-1"
                            title="Download Employee Payslip PDF"
                          >
                            📄 Payslip
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleGenerate(emp._id)}
                              disabled={isThisGenerating}
                              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 transition-colors flex items-center gap-1"
                              title="Recalculate / Update this employee's payslip"
                            >
                              {isThisGenerating ? (
                                <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                '🔄 Recalculate'
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GeneratePayroll;

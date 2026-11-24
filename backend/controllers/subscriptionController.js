const Razorpay = require('razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const LandingContent = require('../models/LandingContent');
const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');

// Helper to get Razorpay instance
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (key_id && key_secret && key_id !== 'rzp_test_placeholder_id') {
    return new Razorpay({ key_id, key_secret });
  }
  return null;
};

// Helper to get active pricing plans from DB (or fallback defaults)
const getPlanPricing = async (planId) => {
  const cms = await LandingContent.findOne({ key: 'main_landing_cms' });
  const pricing = cms?.pricingPlans || {
    monthly: { price: 999, title: 'Monthly Flex' },
    yearly: { price: 9999, title: 'Annual Growth' },
    three_year: { price: 24999, title: '3-Year Enterprise' },
  };

  const selected = pricing[planId];
  if (!selected) {
    throw new Error('Invalid plan selected');
  }

  const durationDaysMap = {
    monthly: 30,
    yearly: 365,
    three_year: 1095,
  };

  return {
    price: selected.price,
    title: selected.title,
    durationDays: durationDaysMap[planId] || 30,
  };
};

/**
 * 1. CREATE RAZORPAY ORDER (PUBLIC)
 * POST /api/subscription/create-order
 */
exports.createOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ message: 'Plan ID is required' });
    }

    const planInfo = await getPlanPricing(planId);
    const amountInPaise = Math.round(planInfo.price * 100);

    const rzp = getRazorpayInstance();
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';

    if (rzp) {
      // Real Razorpay Order Creation
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${planId}_${Date.now()}`,
        payment_capture: 1,
      };
      const order = await rzp.orders.create(options);
      return res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        planTitle: planInfo.title,
        price: planInfo.price,
        isMock: false,
      });
    }

    // Seamless Sandbox / Test fallback when credentials are not yet entered
    const mockOrderId = `order_mock_${Date.now()}`;
    return res.json({
      success: true,
      orderId: mockOrderId,
      amount: amountInPaise,
      currency: 'INR',
      key: keyId,
      planTitle: planInfo.title,
      price: planInfo.price,
      isMock: true,
      notice: 'Running in sandbox mode. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env for live gateway.',
    });
  } catch (error) {
    console.error('Create Razorpay Order Error:', error);
    res.status(500).json({ message: error.message || 'Failed to create order' });
  }
};

/**
 * 2. VERIFY RAZORPAY PAYMENT & CREATE COMPANY ADMIN ACCOUNT (PUBLIC)
 * POST /api/subscription/verify-and-register
 */
exports.verifyAndRegister = async (req, res) => {
  try {
    const {
      planId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      companyName,
      adminName,
      adminEmail,
      password,
      phone,
    } = req.body;

    if (!planId || !companyName || !adminName || !adminEmail || !password) {
      return res.status(400).json({ message: 'All registration fields are required' });
    }

    // Verify Signature if live Razorpay keys are active and not mock
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret && razorpaySignature && !razorpayOrderId.startsWith('order_mock_')) {
      const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generated_signature !== razorpaySignature) {
        return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
      }
    }

    // Check if user already exists
    const cleanEmail = adminEmail.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email already exists. Please sign in or use another email.',
      });
    }

    const planInfo = await getPlanPricing(planId);

    // Calculate sequential employee code for Admin
    const adminCount = await User.countDocuments({ role: 'Admin' });
    const employeeCode = `ADM-${String(adminCount + 1).padStart(3, '0')}`;

    // Create the Company Admin User
    const adminUser = await User.create({
      name: adminName.trim(),
      email: cleanEmail,
      password,
      role: 'Admin',
      employeeCode,
      designation: 'Managing Director / Founder',
      department: 'Executive Board',
      phone: phone ? phone.trim() : '',
      companyName: companyName.trim(),
    });

    // Link companyId to their own ID
    adminUser.companyId = adminUser._id;
    await adminUser.save();

    // Create Active Subscription
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + planInfo.durationDays * 24 * 60 * 60 * 1000);

    const paymentRef = razorpayPaymentId || `pay_mock_${Date.now()}`;
    const subscription = await Subscription.create({
      companyId: adminUser._id,
      companyName: adminUser.companyName,
      adminName: adminUser.name,
      adminEmail: adminUser.email,
      adminPhone: adminUser.phone,
      planId,
      planName: planInfo.title,
      amount: planInfo.price,
      currency: 'INR',
      status: 'active',
      startDate,
      endDate,
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: paymentRef,
      razorpaySignature: razorpaySignature || '',
      history: [
        {
          planId,
          planName: planInfo.title,
          amount: planInfo.price,
          paymentDate: startDate,
          startDate,
          endDate,
          razorpayPaymentId: paymentRef,
        },
      ],
    });

    // Generate JWT token for auto login
    const token = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'supersecretjwtkey_employeetracker_2026',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Payment verified & Enterprise Admin account created! 🎉',
      token,
      user: {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        employeeCode: adminUser.employeeCode,
        companyName: adminUser.companyName,
        companyId: adminUser.companyId,
      },
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        daysRemaining: subscription.daysRemaining,
      },
    });
  } catch (error) {
    console.error('Verify & Register Error:', error);
    res.status(500).json({ message: error.message || 'Registration failed after payment' });
  }
};

/**
 * 3. GET CURRENT ADMIN'S SUBSCRIPTION STATUS (PROTECTED: ADMIN)
 * GET /api/subscription/my-status
 */
exports.getMySubscriptionStatus = async (req, res) => {
  try {
    const companyId = req.user.companyId || req.user._id;
    const subscription = await Subscription.findOne({ companyId }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        status: 'none',
        daysRemaining: 0,
      });
    }

    const now = Date.now();
    const diffTime = new Date(subscription.endDate).getTime() - now;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Dynamic state computation
    let computedStatus = subscription.status;
    if (daysRemaining > 5) {
      computedStatus = 'active';
    } else if (daysRemaining > 0 && daysRemaining <= 5) {
      computedStatus = 'expiring_soon';
    } else if (daysRemaining <= 0 && daysRemaining >= -5) {
      computedStatus = 'grace_period';
    } else if (daysRemaining < -5) {
      computedStatus = 'expired';
    }

    if (computedStatus !== subscription.status) {
      subscription.status = computedStatus;
      await subscription.save();
    }

    res.json({
      hasSubscription: true,
      planId: subscription.planId,
      planName: subscription.planName,
      amount: subscription.amount,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      status: computedStatus,
      daysRemaining,
      isExpiringSoon: daysRemaining <= 5 && daysRemaining > 0,
      isGracePeriod: daysRemaining <= 0 && daysRemaining >= -5,
      isExpired: daysRemaining < -5,
      companyName: subscription.companyName,
    });
  } catch (error) {
    console.error('Get Subscription Status Error:', error);
    res.status(500).json({ message: 'Failed to fetch subscription status' });
  }
};

/**
 * 4. RENEW SUBSCRIPTION (PROTECTED: ADMIN)
 * POST /api/subscription/renew
 */
exports.renewSubscription = async (req, res) => {
  try {
    const { planId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const companyId = req.user.companyId || req.user._id;

    const subscription = await Subscription.findOne({ companyId });
    if (!subscription) {
      return res.status(404).json({ message: 'No existing subscription record found' });
    }

    const planInfo = await getPlanPricing(planId);

    // Calculate new start and end dates without data loss
    const now = new Date();
    const currentEnd = new Date(subscription.endDate);
    const newStart = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(newStart.getTime() + planInfo.durationDays * 24 * 60 * 60 * 1000);

    const paymentRef = razorpayPaymentId || `pay_renew_${Date.now()}`;

    // Update subscription
    subscription.planId = planId;
    subscription.planName = planInfo.title;
    subscription.amount = planInfo.price;
    subscription.startDate = newStart;
    subscription.endDate = newEnd;
    subscription.status = 'active';
    subscription.razorpayOrderId = razorpayOrderId || '';
    subscription.razorpayPaymentId = paymentRef;
    subscription.razorpaySignature = razorpaySignature || '';

    // Append to renewal history
    subscription.history.push({
      planId,
      planName: planInfo.title,
      amount: planInfo.price,
      paymentDate: now,
      startDate: newStart,
      endDate: newEnd,
      razorpayPaymentId: paymentRef,
    });

    await subscription.save();

    res.json({
      success: true,
      message: `Successfully renewed subscription to ${planInfo.title}! 🚀`,
      subscription: {
        planName: subscription.planName,
        status: subscription.status,
        endDate: subscription.endDate,
        daysRemaining: subscription.daysRemaining,
      },
    });
  } catch (error) {
    console.error('Renew Subscription Error:', error);
    res.status(500).json({ message: error.message || 'Renewal failed' });
  }
};

/**
 * 5. GET ALL SUBSCRIPTIONS (SUPERADMIN ONLY)
 * GET /api/subscription/all
 */
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { adminName: { $regex: search, $options: 'i' } },
        { adminEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const subscriptions = await Subscription.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: subscriptions.length,
      subscriptions,
    });
  } catch (error) {
    console.error('Get All Subscriptions Error:', error);
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
};

/**
 * 6. GET REVENUE STATS & ANALYTICS (SUPERADMIN ONLY)
 * GET /api/subscription/revenue-stats
 */
exports.getRevenueStats = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({});

    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let yearlyRevenue = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Monthly breakdown for graphs (last 6 months)
    const monthlyMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`;
      monthlyMap[key] = 0;
    }

    subscriptions.forEach((sub) => {
      if (Array.isArray(sub.history) && sub.history.length > 0) {
        sub.history.forEach((h) => {
          const amt = h.amount || 0;
          totalRevenue += amt;

          const pDate = new Date(h.paymentDate || sub.createdAt);
          if (pDate.getFullYear() === currentYear) {
            yearlyRevenue += amt;
            if (pDate.getMonth() === currentMonth) {
              monthlyRevenue += amt;
            }
          }

          const chartKey = `${pDate.toLocaleString('en', { month: 'short' })} ${pDate.getFullYear()}`;
          if (monthlyMap[chartKey] !== undefined) {
            monthlyMap[chartKey] += amt;
          }
        });
      } else {
        const amt = sub.amount || 0;
        totalRevenue += amt;
        const pDate = new Date(sub.startDate || sub.createdAt);
        if (pDate.getFullYear() === currentYear) {
          yearlyRevenue += amt;
          if (pDate.getMonth() === currentMonth) {
            monthlyRevenue += amt;
          }
        }
      }
    });

    const revenueChartData = Object.keys(monthlyMap).map((month) => ({
      month,
      revenue: monthlyMap[month],
    }));

    const activeCount = subscriptions.filter((s) => s.status === 'active').length;
    const expiringSoonCount = subscriptions.filter((s) => s.status === 'expiring_soon').length;
    const expiredCount = subscriptions.filter((s) => s.status === 'expired' || s.status === 'grace_period').length;

    res.json({
      success: true,
      stats: {
        totalRevenue,
        monthlyRevenue,
        yearlyRevenue,
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeCount,
        expiringSoonSubscriptions: expiringSoonCount,
        expiredSubscriptions: expiredCount,
      },
      revenueChartData,
    });
  } catch (error) {
    console.error('Get Revenue Stats Error:', error);
    res.status(500).json({ message: 'Failed to compute revenue statistics' });
  }
};

/**
 * 7. EXPORT SUBSCRIPTIONS & REVENUE TO EXCEL (SUPERADMIN ONLY)
 * GET /api/subscription/export-excel
 */
exports.exportSubscriptionsExcel = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({}).sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Employee Tracker Enterprise';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Enterprise Subscriptions', {
      views: [{ showGridLines: true }],
    });

    // Title Row
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'ENTERPRISE HRMS — CORPORATE SUBSCRIPTION & REVENUE REPORT';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08252B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    // Subtitle / Date
    sheet.mergeCells('A2:L2');
    const metaCell = sheet.getCell('A2');
    metaCell.value = `Generated On: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  |  Confidential Financial Data`;
    metaCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF134E4A' } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    sheet.getRow(3).height = 10;

    // Headers
    const headers = [
      'Company Name',
      'Admin Name',
      'Admin Email',
      'Phone',
      'Plan Type',
      'Amount (₹)',
      'Start Date',
      'Expiry Date',
      'Days Left',
      'Status',
      'Renewals',
      'Payment Ref',
    ];
    const headerRow = sheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E4B56' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    let rowIndex = 5;
    let grandTotal = 0;

    subscriptions.forEach((s) => {
      grandTotal += s.amount || 0;
      const daysLeft = s.daysRemaining;

      const row = sheet.getRow(rowIndex);
      row.values = [
        s.companyName || '—',
        s.adminName,
        s.adminEmail,
        s.adminPhone || '—',
        s.planName,
        s.amount,
        new Date(s.startDate).toLocaleDateString('en-IN'),
        new Date(s.endDate).toLocaleDateString('en-IN'),
        daysLeft,
        s.status.toUpperCase(),
        (s.history && s.history.length > 0) ? s.history.length : 1,
        s.razorpayPaymentId || '—',
      ];
      row.height = 22;

      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9.5 };
        cell.alignment = {
          horizontal: colNum === 6 ? 'right' : (colNum >= 7 && colNum <= 11 ? 'center' : 'left'),
          vertical: 'middle',
        };
        if (colNum === 6) cell.numFmt = '₹#,##0';
      });

      rowIndex++;
    });

    // Grand Total Row
    const totalRow = sheet.getRow(rowIndex);
    totalRow.height = 24;
    sheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const totalLabel = sheet.getCell(`A${rowIndex}`);
    totalLabel.value = 'TOTAL REVENUE';
    totalLabel.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08252B' } };
    totalLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    totalRow.getCell(6).value = grandTotal;
    totalRow.getCell(6).numFmt = '₹#,##0';
    totalRow.getCell(6).font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totalRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF08252B' } };

    sheet.columns.forEach((col) => {
      col.width = 18;
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + `Subscriptions_Revenue_Report_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export Subscriptions Excel Error:', error);
    res.status(500).json({ message: 'Failed to export subscriptions' });
  }
};

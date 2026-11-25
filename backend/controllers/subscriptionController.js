const Razorpay = require('razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const LandingContent = require('../models/LandingContent');
const SystemSettings = require('../models/SystemSettings');
const sendEmail = require('../utils/sendEmail');
const sendCredentialsEmail = require('../utils/sendCredentialsEmail');
const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');

// Helper to resolve Razorpay credentials from env or SuperAdmin DB config
const getRazorpayCredentials = async () => {
  const setting = await SystemSettings.findOne({ key: 'razorpay_credentials' });
  const dbKey = setting?.value?.keyId?.trim();
  const dbSecret = setting?.value?.keySecret?.trim();

  // If explicitly updated via SuperAdmin CMS, prefer DB config so live key switching works without restart
  if (setting?.value?.updatedViaCMS && dbKey && dbSecret) {
    return { key_id: dbKey, key_secret: dbSecret, source: 'cms' };
  }

  const envKey = process.env.RAZORPAY_KEY_ID?.trim();
  const envSecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (envKey && envSecret && envKey !== 'rzp_test_placeholder_id' && envKey !== 'rzp_test_mock') {
    return { key_id: envKey, key_secret: envSecret, source: 'environment' };
  }

  if (dbKey && dbSecret) {
    return { key_id: dbKey, key_secret: dbSecret, source: 'database' };
  }

  return null;
};

// Helper to get active Razorpay SDK client
const getRazorpayClient = async () => {
  const creds = await getRazorpayCredentials();
  if (!creds) return null;
  return {
    instance: new Razorpay({ key_id: creds.key_id, key_secret: creds.key_secret }),
    creds,
  };
};

// Timing-safe Razorpay HMAC-SHA256 signature verification
const verifyRazorpaySignature = (orderId, paymentId, signature, secret) => {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const sigBuf = Buffer.from(String(signature), 'utf8');
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
};

// Generate collision-free sequential Admin Employee Code (ADM-001, ADM-002, ...)
const generateUniqueAdminCode = async () => {
  let nextAdmNum = 1;
  const existingAdmins = await User.find({ employeeCode: /^ADM-\d+$/i }, 'employeeCode');
  if (existingAdmins.length > 0) {
    let maxAdm = 0;
    existingAdmins.forEach((a) => {
      const m = a.employeeCode.match(/^ADM-(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxAdm) maxAdm = n;
      }
    });
    nextAdmNum = maxAdm + 1;
  }

  while (true) {
    const candidate = `ADM-${String(nextAdmNum).padStart(3, '0')}`;
    const exists = await User.findOne({ employeeCode: candidate });
    if (!exists) return candidate;
    nextAdmNum++;
  }
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
    const amountInPaise = Math.round(Number(planInfo.price) * 100);
    if (!amountInPaise || amountInPaise <= 0) {
      return res.status(400).json({ message: 'Invalid plan price configured' });
    }

    const client = await getRazorpayClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: 'Razorpay payment gateway credentials are not configured yet.',
      });
    }

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${planId}_${Date.now()}`,
      payment_capture: 1,
      notes: {
        planId,
        planTitle: planInfo.title,
      },
    };

    const order = await client.instance.orders.create(options);

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: client.creds.key_id,
      planTitle: planInfo.title,
      price: planInfo.price,
      isMock: false,
    });
  } catch (error) {
    console.error('Create Razorpay Order Error:', error);
    const msg = error?.error?.description || error.message || 'Failed to create Razorpay order';
    res.status(500).json({ success: false, message: msg });
  }
};

/**
 * 1B. VERIFY RAZORPAY PAYMENT SIGNATURE (PUBLIC)
 * POST /api/subscription/verify-payment
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Incomplete payment verification details' });
    }

    const creds = await getRazorpayCredentials();
    if (!creds) {
      return res.status(503).json({ success: false, message: 'Payment gateway not configured' });
    }

    const isValidSig = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      creds.key_secret
    );
    if (!isValidSig) {
      return res.status(400).json({ success: false, message: 'Payment signature mismatch' });
    }

    const existingSub = await Subscription.findOne({
      $or: [{ razorpayPaymentId }, { 'history.razorpayPaymentId': razorpayPaymentId }],
    });
    if (existingSub) {
      return res.status(409).json({
        success: false,
        message: 'This payment reference has already been used for a workspace.',
      });
    }

    return res.json({ success: true, verified: true, razorpayPaymentId, razorpayOrderId });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ success: false, message: 'Payment verification check failed' });
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

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        message: 'Razorpay payment verification data is required before creating an Admin account.',
      });
    }

    const creds = await getRazorpayCredentials();
    if (!creds) {
      return res.status(503).json({ message: 'Razorpay payment gateway is not configured' });
    }

    // Strict HMAC-SHA256 verification (no mock bypass allowed)
    const isValidSig = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      creds.key_secret
    );
    if (!isValidSig) {
      return res.status(400).json({ message: 'Payment verification failed: invalid Razorpay signature' });
    }

    // Prevent replay attack using an already redeemed Razorpay payment ID
    const alreadyUsed = await Subscription.findOne({
      $or: [{ razorpayPaymentId }, { 'history.razorpayPaymentId': razorpayPaymentId }],
    });
    if (alreadyUsed) {
      return res.status(409).json({
        message: 'This Razorpay payment has already been redeemed for another company account.',
      });
    }

    // Check if user already exists
    const cleanEmail = adminEmail.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      if (existingUser.isDeleted) {
        return res.status(400).json({
          message: 'This email belongs to a deactivated employee currently inside an organization Recycle Bin. Use a different Admin email.',
        });
      }
      return res.status(400).json({
        message: 'An account with this email already exists. Please use a different work email for this company.',
      });
    }

    const planInfo = await getPlanPricing(planId);

    // Generate collision-free Admin Employee Code (ADM-001, ADM-002, ...)
    const employeeCode = await generateUniqueAdminCode();

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
      isFirstLogin: false,
    });

    // Link companyId to their own ID
    adminUser.companyId = adminUser._id;
    await adminUser.save();

    // Create Active Subscription
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + planInfo.durationDays * 24 * 60 * 60 * 1000);

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
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      history: [
        {
          planId,
          planName: planInfo.title,
          amount: planInfo.price,
          paymentDate: startDate,
          startDate,
          endDate,
          razorpayPaymentId,
        },
      ],
    });

    // Dispatch onboarding email WITH branded Credentials + QR Login Card PDF attached
    const portalOrigin = req.headers.origin || process.env.FRONTEND_URL || 'https://employee-tracker-project.sagnikmondal.in';
    const mailResult = await sendCredentialsEmail.sendDetailed({
      user: adminUser,
      plainPassword: password,
      portalUrl: portalOrigin,
      subscriptionMeta: {
        planName: planInfo.title,
        price: planInfo.price,
        endDate,
        razorpayPaymentId,
      },
    });
    const emailSent = mailResult.sent;

    // Generate JWT token for auto login
    const token = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'supersecretjwtkey_employeetracker_2026',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Payment verified & Enterprise Admin account created! Credentials PDF sent to your email. 🎉'
        : 'Payment verified & Enterprise Admin account created! Save your Employee Code below. 🎉',
      emailSent,
      emailError: mailResult.error || undefined,
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
        razorpayPaymentId,
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

    if (!planId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'Plan ID and verified Razorpay payment details are required' });
    }

    const subscription = await Subscription.findOne({ companyId });
    if (!subscription) {
      return res.status(404).json({ message: 'No existing subscription record found' });
    }

    const creds = await getRazorpayCredentials();
    if (!creds) {
      return res.status(503).json({ message: 'Razorpay payment gateway is not configured' });
    }

    // Strict HMAC-SHA256 signature verification (no mock bypass allowed)
    const isValidSig = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      creds.key_secret
    );
    if (!isValidSig) {
      return res.status(400).json({ message: 'Renewal payment verification failed: invalid signature' });
    }

    // Prevent payment replay
    const alreadyRedeemed = await Subscription.findOne({
      $or: [{ razorpayPaymentId }, { 'history.razorpayPaymentId': razorpayPaymentId }],
    });
    if (alreadyRedeemed) {
      return res.status(409).json({ message: 'This payment reference has already been redeemed' });
    }

    const planInfo = await getPlanPricing(planId);

    // Calculate new start and end dates without data loss
    const now = new Date();
    const currentEnd = new Date(subscription.endDate);
    const newStart = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(newStart.getTime() + planInfo.durationDays * 24 * 60 * 60 * 1000);

    // Update subscription
    subscription.planId = planId;
    subscription.planName = planInfo.title;
    subscription.amount = planInfo.price;
    subscription.startDate = newStart;
    subscription.endDate = newEnd;
    subscription.status = 'active';
    subscription.razorpayOrderId = razorpayOrderId;
    subscription.razorpayPaymentId = razorpayPaymentId;
    subscription.razorpaySignature = razorpaySignature;

    // Append to renewal history
    subscription.history.push({
      planId,
      planName: planInfo.title,
      amount: planInfo.price,
      paymentDate: now,
      startDate: newStart,
      endDate: newEnd,
      razorpayPaymentId,
    });

    await subscription.save();

    // Send renewal receipt email
    sendEmail({
      to: subscription.adminEmail,
      subject: `✅ Subscription Renewed — ${subscription.companyName} (${planInfo.title})`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#08252b;color:#f1f5f9;border-radius:16px;overflow:hidden;border:1px solid #14b8a6;">
          <div style="background:linear-gradient(135deg,#0d9488,#042f2e);padding:28px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;">SUBSCRIPTION RENEWED SUCCESSFULLY</h1>
          </div>
          <div style="padding:26px;">
            <p style="font-size:15px;color:#e2e8f0;margin-top:0;">Dear <strong>${subscription.adminName}</strong>,</p>
            <p style="font-size:14px;color:#94a3b8;">Your corporate plan <strong>${planInfo.title}</strong> (₹${planInfo.price}) has been renewed seamlessly via Razorpay.</p>
            <div style="background:#0f172a;border:1px solid #14b8a6;border-radius:10px;padding:14px;margin:16px 0;">
              <p style="margin:4px 0;font-size:13px;color:#94a3b8;">New Expiry Date: <strong style="color:#34d399;">${newEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></p>
              <p style="margin:4px 0;font-size:12px;color:#64748b;">Payment Reference: ${razorpayPaymentId}</p>
            </div>
          </div>
        </div>
      `,
    }).catch(() => {});

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

/**
 * 8. GET RAZORPAY GATEWAY CONFIG (SUPERADMIN ONLY)
 * GET /api/subscription/gateway-config
 */
exports.getGatewayConfig = async (req, res) => {
  try {
    const creds = await getRazorpayCredentials();
    if (!creds) {
      return res.json({
        success: true,
        configured: false,
        keyId: '',
        maskedSecret: '',
        mode: 'unconfigured',
        source: 'none',
      });
    }

    const mask = (str) =>
      str && str.length > 8 ? `${str.slice(0, 4)}${'•'.repeat(Math.max(4, str.length - 8))}${str.slice(-4)}` : '••••••••';

    res.json({
      success: true,
      configured: true,
      keyId: creds.key_id,
      maskedSecret: mask(creds.key_secret),
      mode: creds.key_id.startsWith('rzp_live_') ? 'live' : 'test',
      source: creds.source,
    });
  } catch (error) {
    console.error('Get Gateway Config Error:', error);
    res.status(500).json({ message: 'Failed to load payment gateway settings' });
  }
};

/**
 * 9. UPDATE RAZORPAY GATEWAY CREDENTIALS (SUPERADMIN ONLY)
 * PUT /api/subscription/gateway-config
 */
exports.updateGatewayConfig = async (req, res) => {
  try {
    const { keyId, keySecret } = req.body;
    const cleanKey = keyId ? keyId.trim() : '';
    const cleanSecret = keySecret ? keySecret.trim() : '';

    if (!cleanKey || !cleanSecret) {
      return res.status(400).json({ message: 'Both Razorpay Key ID and Key Secret are required' });
    }
    if (!cleanKey.startsWith('rzp_test_') && !cleanKey.startsWith('rzp_live_')) {
      return res.status(400).json({ message: 'Invalid Razorpay Key ID format (must start with rzp_test_ or rzp_live_)' });
    }

    // Verify credentials against Razorpay API before persisting
    const testClient = new Razorpay({ key_id: cleanKey, key_secret: cleanSecret });
    try {
      await testClient.orders.all({ count: 1 });
    } catch (rzpErr) {
      const desc = rzpErr?.error?.description || rzpErr.message || 'Authentication with Razorpay failed';
      return res.status(400).json({ message: `Invalid Razorpay credentials: ${desc}` });
    }

    await SystemSettings.findOneAndUpdate(
      { key: 'razorpay_credentials' },
      {
        key: 'razorpay_credentials',
        value: {
          keyId: cleanKey,
          keySecret: cleanSecret,
          mode: cleanKey.startsWith('rzp_live_') ? 'live' : 'test',
          updatedViaCMS: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Razorpay ${cleanKey.startsWith('rzp_live_') ? 'LIVE' : 'TEST'} credentials verified & activated! 💳`,
      mode: cleanKey.startsWith('rzp_live_') ? 'live' : 'test',
      keyId: cleanKey,
    });
  } catch (error) {
    console.error('Update Gateway Config Error:', error);
    res.status(500).json({ message: 'Failed to save payment gateway credentials' });
  }
};

/**
 * 10. GET EMAIL / SMTP CONFIGURATION & DIAGNOSTICS (SUPERADMIN ONLY)
 * GET /api/subscription/email-config
 */
exports.getEmailConfig = async (req, res) => {
  try {
    const summary = await sendEmail.getConfigSummary();
    res.json({ success: true, ...summary });
  } catch (error) {
    console.error('Get Email Config Error:', error);
    res.status(500).json({ message: 'Failed to load email settings' });
  }
};

/**
 * 11. UPDATE EMAIL / SMTP / PORT-443 HTTP RELAY CREDENTIALS (SUPERADMIN ONLY)
 * PUT /api/subscription/email-config
 */
exports.updateEmailConfig = async (req, res) => {
  try {
    const {
      provider, // 'smtp' | 'brevo' | 'resend' | 'webhook'
      host,
      port,
      user,
      pass,
      fromEmail,
      brevoApiKey,
      resendApiKey,
      webhookUrl,
      webhookSecret,
    } = req.body;

    if (host || user || pass) {
      const existingSmtp = await SystemSettings.findOne({ key: 'smtp_credentials' });
      const prevVal = existingSmtp?.value || {};
      const nextUser = user !== undefined ? user.trim() : prevVal.user;
      const nextPass = pass !== undefined && pass.trim() ? pass.trim() : prevVal.pass;

      if (!nextUser || !nextPass) {
        return res.status(400).json({ message: 'SMTP User and App Password are required' });
      }

      await SystemSettings.findOneAndUpdate(
        { key: 'smtp_credentials' },
        {
          key: 'smtp_credentials',
          value: {
            host: (host || prevVal.host || 'smtp.gmail.com').trim(),
            port: parseInt(port || prevVal.port, 10) || 587,
            user: nextUser,
            pass: nextPass,
            from: fromEmail ? fromEmail.trim() : nextUser,
            updatedViaCMS: true,
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    }

    const existingProv = await SystemSettings.findOne({ key: 'email_provider_config' });
    const prevProv = existingProv?.value || {};

    await SystemSettings.findOneAndUpdate(
      { key: 'email_provider_config' },
      {
        key: 'email_provider_config',
        value: {
          provider: provider || prevProv.provider || 'smtp',
          fromEmail: fromEmail !== undefined ? fromEmail.trim() : prevProv.fromEmail || '',
          brevoApiKey: brevoApiKey !== undefined && brevoApiKey.trim() ? brevoApiKey.trim() : prevProv.brevoApiKey || '',
          resendApiKey: resendApiKey !== undefined && resendApiKey.trim() ? resendApiKey.trim() : prevProv.resendApiKey || '',
          webhookUrl: webhookUrl !== undefined ? webhookUrl.trim() : prevProv.webhookUrl || '',
          webhookSecret: webhookSecret !== undefined && webhookSecret.trim() ? webhookSecret.trim() : prevProv.webhookSecret || '',
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const summary = await sendEmail.getConfigSummary();
    res.json({
      success: true,
      message: 'Email gateway configuration saved!',
      ...summary,
    });
  } catch (error) {
    console.error('Update Email Config Error:', error);
    res.status(500).json({ message: 'Failed to save email settings' });
  }
};

/**
 * 12. RUN LIVE TEST EMAIL FROM SERVER WITH DIAGNOSTICS (SUPERADMIN ONLY)
 * POST /api/subscription/test-email
 */
exports.testEmailDelivery = async (req, res) => {
  try {
    const summary = await sendEmail.getConfigSummary();
    const to = (req.body?.to || summary.fromEmail || req.user?.email || '').trim();
    if (!to) {
      return res.status(400).json({ message: 'Test recipient email address is required' });
    }

    const result = await sendEmail.sendDetailed({
      to,
      subject: 'Employee Tracker PRO — Live Server Email Diagnostic Test',
      html: `<div style="font-family:sans-serif;padding:20px;background:#0B0D11;color:#fff;border-radius:12px;">
        <h2 style="color:#D2F801;margin:0 0 8px;">Email Delivery Operational ✅</h2>
        <p style="margin:0;color:#d1d5db;">Sent from your live Employee Tracker backend server at ${new Date().toISOString()}.</p>
      </div>`,
    });

    if (!result.ok) {
      return res.status(502).json({
        success: false,
        message: result.error,
        provider: result.provider,
      });
    }

    res.json({
      success: true,
      message: `Test email delivered successfully to ${to} via ${result.provider}!`,
      provider: result.provider,
      messageId: result.info?.messageId,
    });
  } catch (error) {
    console.error('Test Email Error:', error);
    res.status(500).json({ message: error.message || 'Email test failed' });
  }
};

/**
 * 13. AUTHORIZE SINGLE-USE NONCE FOR VERCEL HTTPS -> SMTP BRIDGE
 * POST /api/subscription/authorize-relay
 */
exports.authorizeEmailRelay = async (req, res) => {
  try {
    const { nonce, to, subject } = req.body || {};
    const authorized = sendEmail.authorizeRelayNonce(nonce, to, subject);
    if (!authorized) {
      return res.status(403).json({
        authorized: false,
        message: 'Invalid or expired relay authorization nonce',
      });
    }
    return res.json({ authorized: true });
  } catch (error) {
    return res.status(500).json({ authorized: false, message: error.message });
  }
};

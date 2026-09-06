// ─────────────────────────────────────────────────────────────────────────────
// bankController.js
// Handles:
//   GET /api/banks/search?q=sbi          → bank name autocomplete
//   GET /api/banks/branches?bank=STATE BANK OF INDIA&branch=SALT LAKE
//                                         → branch search via Razorpay IFSC API
//   GET /api/banks/ifsc/:code             → full details for an IFSC code
// ─────────────────────────────────────────────────────────────────────────────

// ── Comprehensive list of Indian banks (RBI scheduled + major cooperative) ──
const INDIAN_BANKS = [
  { code: 'SBIN', name: 'State Bank of India' },
  { code: 'HDFC', name: 'HDFC Bank' },
  { code: 'ICIC', name: 'ICICI Bank' },
  { code: 'UTIB', name: 'Axis Bank' },
  { code: 'KKBK', name: 'Kotak Mahindra Bank' },
  { code: 'PUNB', name: 'Punjab National Bank' },
  { code: 'CNRB', name: 'Canara Bank' },
  { code: 'UBIN', name: 'Union Bank of India' },
  { code: 'BKID', name: 'Bank of India' },
  { code: 'BARB', name: 'Bank of Baroda' },
  { code: 'IOBA', name: 'Indian Overseas Bank' },
  { code: 'IDIB', name: 'Indian Bank' },
  { code: 'CBIN', name: 'Central Bank of India' },
  { code: 'MAHB', name: 'Bank of Maharashtra' },
  { code: 'UCBA', name: 'UCO Bank' },
  { code: 'UCOS', name: 'UCO Bank' },
  { code: 'PSIB', name: 'Punjab & Sind Bank' },
  { code: 'VIJB', name: 'Vijaya Bank' },
  { code: 'CORP', name: 'Corporation Bank' },
  { code: 'ALLA', name: 'Allahabad Bank' },
  { code: 'ANDB', name: 'Andhra Bank' },
  { code: 'SYNB', name: 'Syndicate Bank' },
  { code: 'ORBC', name: 'Oriental Bank of Commerce' },
  { code: 'DENA', name: 'Dena Bank' },
  { code: 'INDB', name: 'IndusInd Bank' },
  { code: 'YESB', name: 'Yes Bank' },
  { code: 'FDRL', name: 'Federal Bank' },
  { code: 'KARB', name: 'Karnataka Bank' },
  { code: 'KARNATAKA', name: 'Karnataka Bank' },
  { code: 'KVBL', name: 'Karur Vysya Bank' },
  { code: 'CITI', name: 'Citibank' },
  { code: 'HSBC', name: 'HSBC Bank' },
  { code: 'DEUT', name: 'Deutsche Bank' },
  { code: 'BNPA', name: 'BNP Paribas' },
  { code: 'SCBL', name: 'Standard Chartered Bank' },
  { code: 'RATN', name: 'RBL Bank' },
  { code: 'IDFC', name: 'IDFC First Bank' },
  { code: 'BDBL', name: 'Bandhan Bank' },
  { code: 'DLXB', name: 'Dhanlaxmi Bank' },
  { code: 'LAVB', name: 'Lakshmi Vilas Bank' },
  { code: 'NKGSB', name: 'NKGSB Co-operative Bank' },
  { code: 'TMBL', name: 'Tamilnad Mercantile Bank' },
  { code: 'CLBL', name: 'City Union Bank' },
  { code: 'CSBK', name: 'CSB Bank (Catholic Syrian Bank)' },
  { code: 'DCBL', name: 'DCB Bank' },
  { code: 'ESFB', name: 'Equitas Small Finance Bank' },
  { code: 'ESAF', name: 'ESAF Small Finance Bank' },
  { code: 'FSFB', name: 'Fincare Small Finance Bank' },
  { code: 'JANA', name: 'Jana Small Finance Bank' },
  { code: 'NESF', name: 'Northeast Small Finance Bank' },
  { code: 'SFBL', name: 'Suryoday Small Finance Bank' },
  { code: 'UJJI', name: 'Ujjivan Small Finance Bank' },
  { code: 'USFB', name: 'Utkarsh Small Finance Bank' },
  { code: 'APGB', name: 'Andhra Pradesh Grameena Vikas Bank' },
  { code: 'APGV', name: 'Andhra Pragathi Grameena Bank' },
  { code: 'ARUN', name: 'Arunachal Pradesh Rural Bank' },
  { code: 'ASBL', name: 'Assam Gramin Vikash Bank' },
  { code: 'BGVB', name: 'Bangiya Gramin Vikash Bank' },
  { code: 'BGGB', name: 'Baroda Gujarat Gramin Bank' },
  { code: 'BRKGB', name: 'Baroda Rajasthan Kshetriya Gramin Bank' },
  { code: 'BUPB', name: 'Baroda UP Gramin Bank' },
  { code: 'CGGB', name: 'Chhattisgarh Rajya Gramin Bank' },
  { code: 'DCCB', name: 'District Central Co-operative Bank' },
  { code: 'GHPB', name: 'Himachal Pradesh Gramin Bank' },
  { code: 'JTGB', name: 'Jharkhand Rajya Gramin Bank' },
  { code: 'JKGB', name: 'J&K Grameen Bank' },
  { code: 'JAKA', name: 'Jammu & Kashmir Bank' },
  { code: 'KBKGB', name: 'Kalinga Gramya Bank' },
  { code: 'KCCB', name: 'Kalupur Commercial Co-op Bank' },
  { code: 'KVGB', name: 'Karnataka Vikas Grameena Bank' },
  { code: 'KGSG', name: 'Kerala Gramin Bank' },
  { code: 'MPGB', name: 'Madhya Pradesh Gramin Bank' },
  { code: 'MAHAGRAMIN', name: 'Maharashtra Gramin Bank' },
  { code: 'MNGB', name: 'Manipur Rural Bank' },
  { code: 'MSCI', name: 'Meghalaya Rural Bank' },
  { code: 'MIZORAM', name: 'Mizoram Rural Bank' },
  { code: 'NAGALAND', name: 'Nagaland Rural Bank' },
  { code: 'ODGB', name: 'Odisha Gramya Bank' },
  { code: 'PNBGB', name: 'Punjab Gramin Bank' },
  { code: 'RBIS', name: 'Reserve Bank of India' },
  { code: 'RGVN', name: 'Rajasthan Marudhara Gramin Bank' },
  { code: 'SGBV', name: 'Saurashtra Gramin Bank' },
  { code: 'SGRB', name: 'Saptagiri Grameena Bank' },
  { code: 'STBP', name: 'Sutlej Gramin Bank' },
  { code: 'TGMB', name: 'Telangana Grameena Bank' },
  { code: 'TRIPURA', name: 'Tripura Gramin Bank' },
  { code: 'UGGB', name: 'Uttar Bihar Gramin Bank' },
  { code: 'UPGB', name: 'Uttarakhand Gramin Bank' },
  { code: 'VAJRA', name: 'Vajra Gramin and Commercial Bank' },
  { code: 'VGBB', name: 'Vidharbha Konkan Gramin Bank' },
  { code: 'PAYTM', name: 'Paytm Payments Bank' },
  { code: 'AIRP', name: 'Airtel Payments Bank' },
  { code: 'FINO', name: 'Fino Payments Bank' },
  { code: 'INDIA', name: 'India Post Payments Bank' },
  { code: 'JIOP', name: 'Jio Payments Bank' },
  { code: 'NSDL', name: 'NSDL Payments Bank' },
];

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Search Indian banks by name or code
// @route   GET /api/banks/search?q=sbi
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const searchBanks = (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q || q.length < 1) {
    return res.json([]);
  }

  const results = INDIAN_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q)
  )
    .slice(0, 10)                       // max 10 suggestions
    .map(({ code, name }) => ({ code, name }));

  // Deduplicate by name (some banks have multiple codes)
  const seen = new Set();
  const unique = results.filter((b) => {
    if (seen.has(b.name)) return false;
    seen.add(b.name);
    return true;
  });

  res.json(unique);
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Search branches using Razorpay IFSC API (proxied from backend)
// @route   GET /api/banks/branches?bank=STATE BANK OF INDIA&branch=SALT LAKE
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const searchBranches = async (req, res) => {
  const { bank, branch } = req.query;
  if (!branch || branch.trim().length < 2) {
    return res.status(400).json({ message: 'Branch name is required (min 2 characters)' });
  }

  try {
    const base = process.env.IFSC_API_BASE_URL || 'https://ifsc.razorpay.com';
    const params = new URLSearchParams();
    if (bank)   params.set('bank',   bank.trim().toUpperCase());
    if (branch) params.set('branch', branch.trim().toUpperCase());

    const response = await fetch(`${base}/search?${params.toString()}`);
    if (!response.ok) {
      return res.status(response.status).json({ message: 'IFSC API error' });
    }
    const data = await response.json();
    // Razorpay wraps results in { data: [...] } OR returns array directly
    const list = Array.isArray(data) ? data : (data.data || []);
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reach IFSC API', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get full bank details for an IFSC code
// @route   GET /api/banks/ifsc/:code
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getIfscDetails = async (req, res) => {
  const { code } = req.params;
  if (!code || code.trim().length !== 11) {
    return res.status(400).json({ message: 'A valid 11-character IFSC code is required' });
  }

  try {
    const base = process.env.IFSC_API_BASE_URL || 'https://ifsc.razorpay.com';
    const response = await fetch(`${base}/${code.trim().toUpperCase()}`);
    if (response.status === 404) {
      return res.status(404).json({ message: 'IFSC code not found' });
    }
    if (!response.ok) {
      return res.status(response.status).json({ message: 'IFSC API error' });
    }
    const data = await response.json();
    // Return a clean subset of fields
    res.json({
      ifsc:    data.IFSC,
      bank:    data.BANK,
      branch:  data.BRANCH,
      address: data.ADDRESS,
      city:    data.CITY,
      district: data.DISTRICT,
      state:   data.STATE,
      contact: data.CONTACT || '',
      neft:    data.NEFT,
      rtgs:    data.RTGS,
      imps:    data.IMPS,
      upi:     data.UPI,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reach IFSC API', error: error.message });
  }
};

module.exports = { searchBanks, searchBranches, getIfscDetails };

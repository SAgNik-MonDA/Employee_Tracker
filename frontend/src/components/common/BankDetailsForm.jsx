/**
 * BankDetailsForm.jsx
 *
 * Reusable bank details form with:
 *  1. Bank name autocomplete (backend /api/banks/search)
 *  2. Branch name input → backend /api/banks/branches proxy (Razorpay)
 *  3. IFSC auto-fill via backend /api/banks/ifsc/:code
 *  4. Bank address auto-fill
 *
 * Props:
 *   data      - { bankName, branchName, ifscCode, bankAddress, accountHolderName, accountNumber }
 *   onChange  - (updatedData) => void
 *   disabled  - boolean (lock all fields)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import API from '../../api/axios';

const Field = ({ label, children, hint }) => (
  <div>
    <label className="block text-xs font-semibold text-surface-400 mb-1 uppercase tracking-wide">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-surface-600 mt-0.5">{hint}</p>}
  </div>
);

const BankDetailsForm = ({ data, onChange, disabled = false }) => {
  // ── Bank autocomplete state ─────────────────────────────────────────────────
  const [bankQuery, setBankQuery]       = useState(data?.bankName || '');
  const [bankSuggestions, setBankSuggestions] = useState([]);
  const [showBankDrop, setShowBankDrop] = useState(false);
  const [bankSelected, setBankSelected] = useState(!!data?.bankName);

  // ── Branch state ────────────────────────────────────────────────────────────
  const [branchQuery, setBranchQuery]   = useState(data?.branchName || '');
  const [branchResults, setBranchResults] = useState([]);
  const [showBranchDrop, setShowBranchDrop] = useState(false);

  // ── Loading states ──────────────────────────────────────────────────────────
  const [fetchingBanks, setFetchingBanks]     = useState(false);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [fetchingIfsc, setFetchingIfsc]         = useState(false);

  const bankDebounce   = useRef(null);
  const branchDebounce = useRef(null);
  const bankRef        = useRef(null);
  const branchRef      = useRef(null);

  // Sync external data changes (e.g. when editing loads existing data)
  useEffect(() => {
    setBankQuery(data?.bankName || '');
    setBranchQuery(data?.branchName || '');
    setBankSelected(!!data?.bankName);
  }, [data?.bankName, data?.branchName]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bankRef.current && !bankRef.current.contains(e.target))   setShowBankDrop(false);
      if (branchRef.current && !branchRef.current.contains(e.target)) setShowBranchDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Bank search (debounced) ─────────────────────────────────────────────────
  const handleBankInput = (e) => {
    const val = e.target.value;
    setBankQuery(val);
    setBankSelected(false);
    // Reset downstream fields when bank changes
    onChange({ ...data, bankName: val, branchName: '', ifscCode: '', bankAddress: '' });
    setBranchQuery('');
    setBranchResults([]);

    clearTimeout(bankDebounce.current);
    if (val.trim().length < 1) { setBankSuggestions([]); setShowBankDrop(false); return; }

    bankDebounce.current = setTimeout(async () => {
      setFetchingBanks(true);
      try {
        const { data: res } = await API.get(`/banks/search?q=${encodeURIComponent(val)}`);
        setBankSuggestions(res);
        setShowBankDrop(res.length > 0);
      } catch { /* silent */ }
      finally { setFetchingBanks(false); }
    }, 280);
  };

  const selectBank = (bank) => {
    setBankQuery(bank.name);
    setBankSelected(true);
    setBankSuggestions([]);
    setShowBankDrop(false);
    onChange({ ...data, bankName: bank.name, branchName: '', ifscCode: '', bankAddress: '' });
    setBranchQuery('');
    setBranchResults([]);
  };

  // ── Branch search (debounced) — needs bank name ─────────────────────────────
  const handleBranchInput = (e) => {
    const val = e.target.value;
    setBranchQuery(val);
    onChange({ ...data, branchName: val, ifscCode: '', bankAddress: '' });

    clearTimeout(branchDebounce.current);
    if (val.trim().length < 2) { setBranchResults([]); setShowBranchDrop(false); return; }

    branchDebounce.current = setTimeout(async () => {
      setFetchingBranches(true);
      try {
        const params = new URLSearchParams();
        if (data?.bankName) params.set('bank', data.bankName);
        params.set('branch', val);
        const { data: res } = await API.get(`/banks/branches?${params.toString()}`);
        const list = Array.isArray(res) ? res : (res.data || []);
        setBranchResults(list);
        setShowBranchDrop(list.length > 0);
      } catch { /* silent */ }
      finally { setFetchingBranches(false); }
    }, 350);
  };

  const selectBranch = useCallback(async (branch) => {
    // branch object from Razorpay: { BANK, IFSC, BRANCH, ADDRESS, ... }
    const ifsc    = branch.IFSC    || '';
    const address = branch.ADDRESS || '';
    const bankName = branch.BANK   || data?.bankName || '';

    setBranchQuery(branch.BRANCH || branch.branchName || '');
    setBranchResults([]);
    setShowBranchDrop(false);

    // If we already have the data from branch result, use it directly
    if (ifsc) {
      onChange({
        ...data,
        bankName,
        branchName:  branch.BRANCH || '',
        ifscCode:    ifsc,
        bankAddress: address,
      });
    }
  }, [data, onChange]);

  // ── Manual IFSC entry → auto-fetch address ──────────────────────────────────
  const handleIfscInput = async (e) => {
    const val = e.target.value.toUpperCase();
    onChange({ ...data, ifscCode: val });
    if (val.length === 11) {
      setFetchingIfsc(true);
      try {
        const { data: res } = await API.get(`/banks/ifsc/${val}`);
        onChange({
          ...data,
          ifscCode:    res.ifsc    || val,
          bankAddress: res.address || '',
          bankName:    data?.bankName || res.bank || '',
          branchName:  data?.branchName || res.branch || '',
        });
        if (!data?.bankName && res.bank) setBankQuery(res.bank);
        if (!data?.branchName && res.branch) setBranchQuery(res.branch);
      } catch { /* silent — bad IFSC */ }
      finally { setFetchingIfsc(false); }
    }
  };

  const inputCls = `w-full bg-surface-800/60 border border-surface-600/50 rounded-xl px-3 py-2 text-sm text-surface-200 
    placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 
    transition-all duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  const dropCls = `absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-600/50 
    rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto`;

  const itemCls = 'px-3 py-2.5 text-sm text-surface-200 hover:bg-primary-500/10 hover:text-primary-300 cursor-pointer transition-colors border-b border-surface-700/30 last:border-0';

  return (
    <div className="space-y-4">
      {/* ── Bank Name ── */}
      <div className="relative" ref={bankRef}>
        <Field label="Bank Name" hint="Type to search — all Indian banks included">
          <div className="relative">
            <input
              type="text"
              value={bankQuery}
              onChange={handleBankInput}
              onFocus={() => bankSuggestions.length > 0 && setShowBankDrop(true)}
              disabled={disabled}
              className={inputCls}
              placeholder="e.g. State Bank of India, HDFC, Kotak..."
              autoComplete="off"
            />
            {fetchingBanks && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 text-[10px] animate-pulse">searching...</span>
            )}
          </div>
        </Field>
        {showBankDrop && (
          <div className={dropCls}>
            {bankSuggestions.map((b) => (
              <div key={b.code} className={itemCls} onMouseDown={() => selectBank(b)}>
                <span className="font-medium">{b.name}</span>
                <span className="ml-2 text-xs text-surface-500 font-mono">{b.code}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Branch Name ── */}
      <div className="relative" ref={branchRef}>
        <Field
          label="Branch Name"
          hint={bankSelected ? 'Type branch name — IFSC & address auto-fill on selection' : 'Select a bank first'}
        >
          <div className="relative">
            <input
              type="text"
              value={branchQuery}
              onChange={handleBranchInput}
              onFocus={() => branchResults.length > 0 && setShowBranchDrop(true)}
              disabled={disabled || !bankSelected}
              className={inputCls}
              placeholder={bankSelected ? 'Type branch name...' : 'Select bank first'}
              autoComplete="off"
            />
            {fetchingBranches && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 text-[10px] animate-pulse">searching...</span>
            )}
          </div>
        </Field>
        {showBranchDrop && (
          <div className={dropCls}>
            {branchResults.length === 0 ? (
              <div className="px-3 py-3 text-xs text-surface-500 text-center">No branches found</div>
            ) : (
              branchResults.map((b, i) => (
                <div key={b.IFSC || i} className={itemCls} onMouseDown={() => selectBranch(b)}>
                  <div className="font-medium text-surface-200">{b.BRANCH}</div>
                  <div className="text-xs text-surface-500 mt-0.5 font-mono">{b.IFSC}</div>
                  <div className="text-[10px] text-surface-600 mt-0.5 truncate">{b.ADDRESS}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── IFSC Code ── */}
      <Field label={`IFSC Code${fetchingIfsc ? ' — fetching...' : ''}`}>
        <input
          type="text"
          value={data?.ifscCode || ''}
          onChange={handleIfscInput}
          disabled={disabled}
          className={`${inputCls} font-mono tracking-widest uppercase`}
          placeholder="Auto-filled or type 11-char IFSC (e.g. SBIN0001612)"
          maxLength={11}
        />
      </Field>

      {/* ── Bank Address ── */}
      <Field label="Bank Address" hint="Auto-fetched from IFSC — editable if needed">
        <input
          type="text"
          value={data?.bankAddress || ''}
          onChange={(e) => onChange({ ...data, bankAddress: e.target.value })}
          disabled={disabled}
          className={inputCls}
          placeholder="Auto-filled from IFSC lookup"
        />
      </Field>

      {/* ── Divider ── */}
      <div className="border-t border-surface-700/30 pt-1" />

      {/* ── Account Holder ── */}
      <Field label="Account Holder Name">
        <input
          type="text"
          value={data?.accountHolderName || ''}
          onChange={(e) => onChange({ ...data, accountHolderName: e.target.value })}
          disabled={disabled}
          className={inputCls}
          placeholder="Name as in bank records"
        />
      </Field>

      {/* ── Account Number ── */}
      <Field label="Account Number">
        <input
          type="text"
          value={data?.accountNumber || ''}
          onChange={(e) => onChange({ ...data, accountNumber: e.target.value })}
          disabled={disabled}
          className={`${inputCls} font-mono`}
          placeholder="Bank account number"
        />
      </Field>
    </div>
  );
};

export default BankDetailsForm;

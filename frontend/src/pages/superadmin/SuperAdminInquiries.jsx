import { useState, useEffect } from 'react';
import API from '../../api/axios';
import toast from 'react-hot-toast';
import {
  HiOutlineMail,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineReply,
  HiOutlineX,
  HiOutlineRefresh,
} from 'react-icons/hi';

const SuperAdminInquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reply modal state
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/landing/inquiries');
      if (data.inquiries) setInquiries(data.inquiries);
    } catch (error) {
      console.error('Fetch Inquiries Error:', error);
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) {
      toast.error('Please enter a response message');
      return;
    }

    setSendingReply(true);
    try {
      const { data } = await API.post(`/landing/inquiries/${selectedInquiry._id}/reply`, {
        replyMessage: replyText,
      });

      toast.success(data.message || 'Reply email successfully dispatched! 📧');
      setSelectedInquiry(null);
      setReplyText('');
      fetchInquiries();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reply email');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-black text-surface-100">
            Visitor &amp; Client Inquiries
          </h2>
          <p className="text-xs sm:text-sm text-surface-400 mt-1">
            Questions and demonstration requests submitted via the Landing Page Contact form
          </p>
        </div>

        <button
          onClick={fetchInquiries}
          className="p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-surface-100 transition-colors w-fit"
          title="Refresh"
        >
          <HiOutlineRefresh className="w-5 h-5" />
        </button>
      </div>

      {/* Inquiries Table */}
      <div className="liquid-glass rounded-3xl border border-surface-800 shadow-xl overflow-hidden">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Subject</th>
                <th>Message Content</th>
                <th>Received Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : inquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-surface-400 text-xs">
                    No visitor inquiries received yet.
                  </td>
                </tr>
              ) : (
                inquiries.map((inq) => (
                  <tr key={inq._id} className="hover:bg-surface-800/40 transition-colors text-xs">
                    <td>
                      <div className="font-bold text-surface-100">{inq.name}</div>
                      <div className="text-[11px] text-teal-400">{inq.email}</div>
                    </td>

                    <td className="font-semibold text-surface-200">
                      {inq.subject}
                    </td>

                    <td className="max-w-md text-surface-300">
                      <p className="line-clamp-2 leading-relaxed">{inq.message}</p>
                    </td>

                    <td className="text-surface-400 whitespace-nowrap">
                      {new Date(inq.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td>
                      {inq.status === 'Replied' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
                          <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                          <span>Replied</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                          <HiOutlineClock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        onClick={() => {
                          setSelectedInquiry(inq);
                          setReplyText(inq.replyMessage || '');
                        }}
                        className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer"
                      >
                        <HiOutlineReply className="w-3.5 h-3.5" />
                        <span>{inq.status === 'Replied' ? 'View/Resend' : 'Reply by Email'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Reply Email Modal ── */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl border-[1.5px] border-teal-500/40">
            <button
              onClick={() => setSelectedInquiry(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-surface-400 hover:text-surface-100"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                Official Support Dispatch
              </span>
              <h3 className="text-xl font-display font-extrabold text-surface-100 mt-0.5">
                Reply to {selectedInquiry.name}
              </h3>
              <p className="text-xs text-surface-400">
                Sending to: <strong className="text-teal-300">{selectedInquiry.email}</strong>
              </p>
            </div>

            {/* Original Message Box */}
            <div className="p-3.5 bg-surface-900/70 border border-surface-800 rounded-2xl mb-4 text-xs">
              <span className="text-[10px] font-bold text-surface-500 uppercase block mb-1">
                Inquiry: {selectedInquiry.subject}
              </span>
              <p className="text-surface-300 italic">"{selectedInquiry.message}"</p>
            </div>

            <form onSubmit={handleSendReply} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-300 mb-1">
                  Executive Email Reply Message <span className="text-teal-400">*</span>
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your official response to this visitor..."
                  required
                  rows={5}
                  className="input-field text-xs p-3.5 bg-surface-900/60 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-surface-400 hover:text-surface-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReply}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {sendingReply ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <HiOutlineMail className="w-4 h-4" />
                      <span>Dispatch Email Response</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminInquiries;

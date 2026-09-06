import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of ProgressTab
start_idx = content.find('const ProgressTab = ({ team, setTeam, user, headers }) => {')
# Find the start of ShiftsTab
end_idx = content.find('const ShiftsTab = ({ team, setTeam, user, headers }) => {')

if start_idx != -1 and end_idx != -1:
    # Look for the last '};' before ShiftsTab
    
    new_progress_tab = '''const ProgressTab = ({ team, setTeam, user, headers }) => {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const des = (user?.designation || user?.role || '').toLowerCase();
  const isTL = des.includes('team lead');
  const isPM = des.includes('project manager') || des.includes('program manager');
  const isDM = des.includes('delivery manager') || des.includes('operations manager');
  const isAdmin = ['Admin','HR'].includes(user?.role);

  const submit = async () => {
    if (!msg.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post(/api/teams//progress, { message: msg }, { headers });
      setTeam(p => ({ ...p, progressUpdates: [...(p.progressUpdates||[]), data] }));
      setMsg('');
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  const approve = async (updateId, action) => {
    try {
      const { data } = await axios.put(/api/teams//progress//approve, { action }, { headers });
      setTeam(p => ({
        ...p,
        progressUpdates: (p.progressUpdates||[]).map(u => u._id === updateId ? { ...u, ...data } : u),
      }));
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
  };

  return (
    <div className="space-y-5">
      {/* Submit Update */}
      {(isTL || isAdmin) && (
        <div className="glass-card p-4">
          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><HiOutlinePencil className="w-3.5 h-3.5" /> Submit Progress Update</h4>
          <textarea
            rows={3}
            className="input-field resize-none mb-3"
            placeholder="Describe the progress, completion, or delivery milestone..."
            value={msg}
            onChange={e => setMsg(e.target.value)}
          />
          <button onClick={submit} disabled={loading || !msg.trim()} className="btn-primary text-sm py-2 px-5">
            {loading ? 'Submitting...' : '?? Submit to Project Manager'}
          </button>
        </div>
      )}

      {/* Updates List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Progress History</h4>
        {(team.progressUpdates || []).length === 0 && (
          <div className="text-center py-10 text-surface-500 text-sm">No progress updates yet.</div>
        )}
        {[...(team.progressUpdates || [])].reverse().map(u => (
          <div key={u._id} className="glass-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <UserAvatar user={u.submittedBy} size="xs" />
                <div>
                  <p className="text-xs font-bold text-surface-200">{u.submittedBy?.name || 'Unknown'}</p>
                  <p className="text-[10px] text-surface-500">{new Date(u.submittedAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <StatusBadge status={u.status} />
            </div>
            <p className="text-sm text-surface-300 leading-relaxed pl-8">{u.message}</p>

            {/* Approval Chain Timeline */}
            <div className="pl-8 flex items-center gap-2 text-xs">
              <span className={lex items-center gap-1 }>
                {u.pmApprovedBy ? <HiOutlineCheckCircle className="w-3.5 h-3.5" /> : <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                PM Review {u.pmApprovedBy ? ?  : '(Pending)'}
              </span>
              <span className="text-surface-700">?</span>
              <span className={lex items-center gap-1 }>
                {u.dmApprovedBy ? <HiOutlineBadgeCheck className="w-3.5 h-3.5" /> : <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                DM Approval {u.dmApprovedBy ? ?  : '(Pending)'}
              </span>
            </div>

            {/* Action Buttons */}
            {u.status === 'Pending' && (isPM || isAdmin) && (
              <div className="pl-8 flex gap-2">
                <button onClick={() => approve(u._id, 'pm-approve')} className="btn-primary text-xs py-1.5 px-4">? PM Approve</button>
                <button onClick={() => approve(u._id, 'reject')} className="text-xs py-1.5 px-4 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">? Reject</button>
              </div>
            )}
            {u.status === 'PM Approved' && (isDM || isAdmin) && (
              <div className="pl-8 flex gap-2">
                <button onClick={() => approve(u._id, 'dm-approve')} className="btn-primary text-xs py-1.5 px-4">? DM Approve</button>
                <button onClick={() => approve(u._id, 'reject')} className="text-xs py-1.5 px-4 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">? Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};'''
    
    new_content = content[:start_idx] + new_progress_tab + '\n\n// ' + content[end_idx-63:]
    with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed!")
else:
    print("Could not find boundaries")

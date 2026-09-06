import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of ProgressTab
start_idx = content.find('const ProgressTab = ({ team, setTeam, user, headers }) => {')
# Find the start of ShiftsTab
end_idx = content.find('const ShiftsTab = ({ team, setTeam, user, headers }) => {')

if start_idx != -1 and end_idx != -1:
    # Look for the last '};' before ShiftsTab
    end_of_progress = content.rfind('};', start_idx, end_idx) + 2
    
    new_progress_tab = '''const ProgressTab = ({ team, setTeam, user, headers }) => {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const des = (user?.designation || user?.role || '').toLowerCase();
  const isTL = des.includes('team lead');
  const isAdmin = ['Admin', 'HR'].includes(user?.role);

  const submit = async () => {
    if (!msg.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post(/api/teams//progress, { message: msg }, { headers });
      setTeam(p => ({ ...p, progressUpdates: [...(p.progressUpdates || []), data] }));
      setMsg('');
    } catch(e) { alert(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
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
            {loading ? 'Submitting...' : '? Submit Update'}
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
            </div>
            <p className="text-sm text-surface-300 leading-relaxed pl-8">{u.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};'''
    
    new_content = content[:start_idx] + new_progress_tab + '\n\n  // ' + content[end_idx-63:]
    with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed!")
else:
    print("Could not find boundaries")

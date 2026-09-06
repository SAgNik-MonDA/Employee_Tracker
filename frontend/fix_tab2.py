import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "            {/* Approval Chain Timeline */}"
end_marker = "          </div>\n        ))}\n      </div>\n    </div>\n  );\n};"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_marker)
    new_block = '''            {/* Approval Chain Timeline */}
            <div className="pl-8 flex items-center gap-2 text-xs">
              <span className={`flex items-center gap-1 ${u.pmApprovedBy ? 'text-teal-400' : 'text-surface-600'}`}>
                {u.pmApprovedBy ? <HiOutlineCheckCircle className="w-3.5 h-3.5" /> : <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                PM Review {u.pmApprovedBy ? `? ${u.pmApprovedBy?.name || ''}` : '(Pending)'}
              </span>
              <span className="text-surface-700">?</span>
              <span className={`flex items-center gap-1 ${u.dmApprovedBy ? 'text-emerald-400' : 'text-surface-600'}`}>
                {u.dmApprovedBy ? <HiOutlineBadgeCheck className="w-3.5 h-3.5" /> : <HiOutlineExclamationCircle className="w-3.5 h-3.5" />}
                DM Approval {u.dmApprovedBy ? `? ${u.dmApprovedBy?.name || ''}` : '(Pending)'}
              </span>
            </div>

            {/* Action Buttons */}
            {u.status === 'Pending' && canApprovePM && (
              <div className="pl-8 flex gap-2">
                <button onClick={() => approve(u._id, 'pm-approve')} className="btn-primary text-xs py-1.5 px-4">? PM Approve</button>
                <button onClick={() => approve(u._id, 'reject')} className="text-xs py-1.5 px-4 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors">? Reject</button>
              </div>
            )}
            {u.status === 'PM Approved' && canApproveDM && (
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
    
    content = content[:start_idx] + new_block + content[end_idx:]
    with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done")
else:
    print("Not found")

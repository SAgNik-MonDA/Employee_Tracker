import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Action Buttons block
old_block = r"{u.status === 'Pending' && (isPM || isAdmin) && ("
new_block = r"{u.status === 'Pending' && canApprovePM && ("
content = content.replace(old_block, new_block)

old_block2 = r"{u.status === 'PM Approved' && (isDM || isAdmin) && ("
new_block2 = r"{u.status === 'PM Approved' && canApproveDM && ("
content = content.replace(old_block2, new_block2)

with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')

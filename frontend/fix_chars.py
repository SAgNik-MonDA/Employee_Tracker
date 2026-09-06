import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the mangled characters (since python script read utf-8, maybe it wasn't mangled, but let's just make sure)
content = content.replace('? PM Approve', '? PM Approve')
content = content.replace('? Reject', '? Reject')
content = content.replace('? DM Approve', '? DM Approve')
content = content.replace('?? Submit to Project Manager', '?? Submit to Project Manager')
content = content.replace('? Submit Update', '? Submit Update')
content = content.replace('o"', '?')
content = content.replace('o-', '?')

with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')

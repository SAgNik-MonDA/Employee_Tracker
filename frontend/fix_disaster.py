import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# First, protect the known intentional checkmarks/crosses by replacing them with unique placeholders
content = content.replace('? PM Approve', '__CHECK_PM__')
content = content.replace('? Reject', '__CROSS_REJECT__')
content = content.replace('? DM Approve', '__CHECK_DM__')
content = content.replace('? Submit Update', '__CHECK_SUBMIT__')
content = content.replace('? ', '__CHECK_PM_NAME__')
content = content.replace('? ', '__CHECK_DM_NAME__')

# Now revert the global replacements that corrupted the file
content = content.replace('?', 'o"')
content = content.replace('?', 'o-')

# Restore the protected ones
content = content.replace('__CHECK_PM__', '? PM Approve')
content = content.replace('__CROSS_REJECT__', '? Reject')
content = content.replace('__CHECK_DM__', '? DM Approve')
content = content.replace('__CHECK_SUBMIT__', '? Submit Update')
content = content.replace('__CHECK_PM_NAME__', '? ')
content = content.replace('__CHECK_DM_NAME__', '? ')

with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')

import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the mangled characters
content = content.replace('overflow-y-aut?>', 'overflow-y-auto">')
content = content.replace('overflow-x-aut?>', 'overflow-x-auto">')

# Wait, the python script actually wrote ? but PowerShell didn't render it correctly in cat.
# Let's check if it's actually ?>
content = content.replace('overflow-y-aut?>', 'overflow-y-auto">')
content = content.replace('overflow-x-aut?>', 'overflow-x-auto">')

with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')

import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's see what has the checkmark
matches = re.findall(r'.{0,10}?.{0,10}', content)
for m in set(matches):
    print(m)


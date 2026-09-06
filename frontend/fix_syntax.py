import re

with open('src/pages/common/TeamsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix optional chaining
content = content.replace('o".', '?.')
content = content.replace('o".[', '?.[')
content = content.replace('o"(', '?(')

# Fix ternary operators
content = content.replace(' o" ', ' ? ')
content = content.replace('o":', '?:') # Not really used but just in case
content = content.replace('o",', '?,') # ?

# Wait, were there any actual string literals ending in o that got corrupted?
# Like "hello" -> hell? -> hello"
# If so, they are already o" so they are fine!

with open('src/pages/common/TeamsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')

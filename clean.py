with open('backend/server.py', 'r', encoding='utf-8') as f:
    content = f.read()
clean = []
for line in content.split('\n'):
    if 'print(' in line:
        line = ''.join([c for c in line if ord(c) < 128])
    clean.append(line)
with open('backend/server.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(clean))
print("Server cleaned successfully")

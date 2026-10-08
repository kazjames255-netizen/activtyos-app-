import json,re,sys
P='/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/90282caf-1701-4ffc-a82d-955cde3224d8/scratchpad/'
tc=json.load(open(P+'texts-c.json')); td=json.load(open(P+'texts-d.json'))
for k in ['prov-bookings-1440']:
    t=tc[k]
    print(k, len(t))
    for m in re.finditer(r'Ref (QAF-\d+)[^\n]*\n(?:[^\n]*\n){0,14}?£([\d.,]+)',t):
        print(' ',m.group(1),m.group(2))
t=td['par-bookings-1440']
print('PARENT')
for m in re.finditer(r'Ref (QAF-\d+)\n.*?AMOUNT\n£([\d.,]+)',t,re.S):
    print(' ',m.group(1),m.group(2))

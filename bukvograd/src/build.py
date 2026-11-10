import json, os
d=os.path.dirname(os.path.abspath(__file__))
t=open(f'{d}/template.html').read()
t=t.replace('/*PICS*/',open(f'{d}/pics.js').read()+'\n'+open(f'{d}/pics2.js').read()+'\n'+open(f'{d}/pics3.js').read()).replace('/*STROKES*/',open(f'{d}/strokes.js').read()).replace('/*DATA*/',open(f'{d}/game-data.json').read())
open(f'{d}/../index.html','w').write(t)
print(len(t))

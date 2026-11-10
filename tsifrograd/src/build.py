import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda f:open(f'{d}/{f}').read()
t=r('template.html').replace('/*PICS*/',r('pics.js')+'\n'+r('pics2.js')+'\n'+r('pics3.js')).replace('/*DATA*/',r('game-data.json')).replace('/*GAMES*/',r('games.js'))
open(f'{d}/../index.html','w').write(t);print(len(t))

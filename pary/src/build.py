import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda f:open(f'{d}/{f}').read()
t=r('template.html').replace('/*SHARED_CSS*/',r('shared_css.txt')).replace('/*SHARED_JS*/',r('shared_js.txt')).replace('/*PICS*/',r('pics.js')+'\n'+r('pics2.js')+'\n'+r('pics3.js')).replace('/*DATA*/',r('game-data.json')).replace('/*GAME*/',r('game.js'))
open(f'{d}/../index.html','w').write(t);print(len(t))

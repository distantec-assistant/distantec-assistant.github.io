const {chromium}=require('/workspace/games/red-car/test-tools/node_modules/playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});
const js=fs.readFileSync(__dirname+'/pics.js','utf8');
await p.setContent(`<body style="margin:0;display:flex;flex-wrap:wrap;background:#fff8ed;font:12px sans-serif"><script>${js};document.body.innerHTML=Object.keys(PICS).map(k=>'<div style="width:110px;text-align:center;padding:4px"><div style="background:#fff;border-radius:14px">'+picSVG(k).replace('<svg','<svg width=100 height=100')+'</div>'+k+'</div>').join('')</script></body>`);
p.on('pageerror',e=>console.log(e));
await p.screenshot({path:__dirname+'/pics-sheet.png',fullPage:true});await b.close()})();

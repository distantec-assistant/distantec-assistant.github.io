// Contact sheet of pictures: node sheet2.cjs out.png [key-prefix-filter...]
const {chromium}=require('/workspace/games/red-car/test-tools/node_modules/playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});
const js=fs.readFileSync(__dirname+'/pics.js','utf8')+'\n'+(fs.existsSync(__dirname+'/pics2.js')?fs.readFileSync(__dirname+'/pics2.js','utf8'):'')+'\n'+(fs.existsSync(__dirname+'/pics3.js')?fs.readFileSync(__dirname+'/pics3.js','utf8'):'');
const only=JSON.stringify(process.argv.slice(3));
p.on('pageerror',e=>console.log('ERR',e.message));
await p.setContent(`<body style="margin:0;display:flex;flex-wrap:wrap;background:#fff8ed;font:12px sans-serif"><script>${js};const O=${only};document.body.innerHTML=Object.keys(PICS).filter(k=>!O.length||O.includes(k)).map(k=>'<div style="width:110px;text-align:center;padding:4px"><div style="background:#fff;border-radius:14px">'+picSVG(k).replace('<svg','<svg width=100 height=100')+'</div>'+k+'</div>').join('')</script></body>`);
await p.screenshot({path:process.argv[2],fullPage:true});await b.close()})();

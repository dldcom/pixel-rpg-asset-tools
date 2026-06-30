const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dir = 'C:/Users/dldco/Downloads/codex/society-4-1-2-2-/src/assets/buildings/split';
function isBadGreen(r,g,b,a){ return a > 10 && g > 120 && g > r * 1.2 && g > b * 1.2 && (g - Math.max(r,b)) > 30; }
(async()=>{
  const rows=[];
  for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort()) {
    const full = path.join(dir,file);
    const {data,info}=await sharp(full).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let green=0, opaque=0;
    for(let i=0;i<data.length;i+=4){ if(data[i+3]>10) opaque++; if(isBadGreen(data[i],data[i+1],data[i+2],data[i+3])) green++; }
    rows.push({file,width:info.width,height:info.height,opaque,green});
  }
  console.log(JSON.stringify({count:rows.length, bad: rows.filter(r=>r.width!==256||r.height!==220||r.green>0).slice(0,10), maxGreen: Math.max(...rows.map(r=>r.green))}, null, 2));
})();

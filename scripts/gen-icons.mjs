#!/usr/bin/env node
/* Generate public/icons/icon-192.png and icon-512.png from the same frog mark as
   icon.svg, with no external image deps — a tiny supersampled rasterizer + a
   minimal PNG (RGBA) encoder using Node's built-in zlib. Run: node scripts/gen-icons.mjs */
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const TEAL = hex('#3FA7A1'), GREEN = hex('#78d6a8'), MINT = hex('#d9f7e4'), WHITE = [255,255,255], DARK = [34,34,34];

const inEllipse = (x,y,cx,cy,rx,ry) => ((x-cx)**2)/(rx*rx) + ((y-cy)**2)/(ry*ry) <= 1;
function inRoundRect(x,y,w,h,r){
  if (x<0||y<0||x>w||y>h) return false;
  const cx = Math.min(Math.max(x,r),w-r), cy = Math.min(Math.max(y,r),h-r);
  if (x<r&&y<r) return (x-r)**2+(y-r)**2<=r*r;
  if (x>w-r&&y<r) return (x-(w-r))**2+(y-r)**2<=r*r;
  if (x<r&&y>h-r) return (x-r)**2+(y-(h-r))**2<=r*r;
  if (x>w-r&&y>h-r) return (x-(w-r))**2+(y-(h-r))**2<=r*r;
  return true;
}
// returns [r,g,b,a] in 0..255 for a point in the 100x100 design space
function sample(x,y,maskable){
  let col = null;
  if (maskable) col = TEAL;                                   // full bleed
  else if (inRoundRect(x,y,100,100,22)) col = TEAL;           // rounded badge
  const oy = maskable ? -2 : 0;                               // nudge into safe zone
  if (col){
    if (inEllipse(x,y,50,62+oy,28,21)) col = GREEN;
    if (inEllipse(x,y,50,68+oy,15,10)) col = MINT;
    for (const ex of [37,63]) {
      if (inEllipse(x,y,ex,40+oy,10,10)) col = GREEN;
      if (inEllipse(x,y,ex,40+oy,5,5)) col = WHITE;
      if (inEllipse(x,y,ex,41+oy,2.6,2.6)) col = DARK;
    }
  }
  return col ? [col[0],col[1],col[2],255] : [0,0,0,0];
}
function raster(size, maskable){
  const SS = 3, buf = Buffer.alloc(size*size*4);
  for (let py=0; py<size; py++) for (let px=0; px<size; px++){
    let r=0,g=0,b=0,a=0;
    for (let sy=0; sy<SS; sy++) for (let sx=0; sx<SS; sx++){
      const dx = (px + (sx+0.5)/SS)/size*100, dy = (py + (sy+0.5)/SS)/size*100;
      const s = sample(dx,dy,maskable); r+=s[0]*s[3]; g+=s[1]*s[3]; b+=s[2]*s[3]; a+=s[3];
    }
    const n = SS*SS, i=(py*size+px)*4, av=a/n;
    buf[i]   = av? Math.round(r/(a||1)) : 0;
    buf[i+1] = av? Math.round(g/(a||1)) : 0;
    buf[i+2] = av? Math.round(b/(a||1)) : 0;
    buf[i+3] = Math.round(av);
  }
  return buf;
}
function crc32(buf){
  let c=~0; for (let i=0;i<buf.length;i++){ c^=buf[i]; for(let k=0;k<8;k++) c=(c>>>1)^(0xEDB88320&-(c&1)); } return ~c>>>0;
}
function chunk(type, data){
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t=Buffer.from(type,'ascii'); const crc=Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t,data]))); return Buffer.concat([len,t,data,crc]);
}
function png(size, rgba){
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4); ihdr[8]=8; ihdr[9]=6;
  const raw=Buffer.alloc((size*4+1)*size);
  for (let y=0;y<size;y++){ raw[y*(size*4+1)]=0; rgba.copy(raw, y*(size*4+1)+1, y*size*4, (y+1)*size*4); }
  const idat=zlib.deflateSync(raw,{level:9});
  const sig=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

fs.mkdirSync(dir,{recursive:true});
for (const [name,size,mask] of [['icon-192.png',192,false],['icon-512.png',512,false],['maskable-512.png',512,true]]){
  fs.writeFileSync(path.join(dir,name), png(size, raster(size,mask)));
  console.log('wrote icons/'+name);
}

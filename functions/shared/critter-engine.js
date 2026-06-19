/* ============================================================
   CRITTER ENGINE  — canonical, self-contained, DETERMINISTIC.
   render(seed, archetype, rarity) -> SVG string (viewBox 0 0 100 100).
   Same seed -> same critter, forever. Add a species = add ONE
   function to ARCH (append only — never alter an existing one or
   every kid's existing pond changes).

   Dual-mode: usable inline in the browser build AND require()-able
   from Cloud Functions (Node) so the server can mint critters with
   identical output. Do NOT edit existing ARCH functions or the hash
   / rng / traits — they are the determinism contract.
   ============================================================ */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.CritterEngine = mod;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let s=hash(seed);return()=>{s=Math.imul(s^(s>>>15),2246822507);s=Math.imul(s^(s>>>13),3266489909);return((s^(s>>>16))>>>0)/4294967296;};}
  const pick=(r,a)=>a[Math.floor(r()*a.length)];

  function traits(seed,rarity){
    const r=rng(seed);
    const hue=Math.floor(r()*360);
    const harm=pick(r,[28,150,180,205,330]);
    const t={
      hue, hue2:(hue+harm)%360,
      body:`hsl(${hue},62%,61%)`, bodyD:`hsl(${hue},52%,46%)`,
      belly:`hsl(${hue},72%,87%)`, acc:`hsl(${(hue+harm)%360},72%,55%)`,
      pattern:pick(r,['plain','plain','spots','stripes','patches']),
      eyeStyle:pick(r,['round','round','big','sleepy','wink','sparkle']),
      blush:r()<0.45
    };
    if(rarity>=3)t.accessory='crown';
    else if(rarity>=2)t.accessory=pick(r,['bow','flower','hat']);
    else t.accessory=(r()<(rarity>=1?0.28:0.12))?pick(r,['bow','flower','hat','leaf']):'none';
    return t;
  }
  function eyes(t,x1,x2,y,sz){
    sz=sz||1; const s=t.eyeStyle;
    const dot=x=>`<circle cx="${x}" cy="${y}" r="${2.6*sz}" fill="#2a2a2a"/>`;
    const curve=x=>`<path d="M${x-4*sz} ${y} q${4*sz} ${4*sz} ${8*sz} 0" stroke="#2a2a2a" stroke-width="${2*sz}" fill="none" stroke-linecap="round"/>`;
    if(s==='sleepy')return curve(x1)+curve(x2);
    if(s==='wink')return dot(x1)+curve(x2);
    if(s==='big'){const e=x=>`<circle cx="${x}" cy="${y}" r="${4.4*sz}" fill="#fff"/><circle cx="${x}" cy="${y+0.6*sz}" r="${2.8*sz}" fill="#2a2a2a"/><circle cx="${x+1.4*sz}" cy="${y-1.4*sz}" r="${1.2*sz}" fill="#fff"/>`;return e(x1)+e(x2);}
    if(s==='sparkle'){const e=x=>`<circle cx="${x}" cy="${y}" r="${3.4*sz}" fill="#2a2a2a"/><circle cx="${x-1.1*sz}" cy="${y-1.1*sz}" r="${1.1*sz}" fill="#fff"/><circle cx="${x+1.3*sz}" cy="${y+1.1*sz}" r="${0.7*sz}" fill="#fff"/>`;return e(x1)+e(x2);}
    return dot(x1)+dot(x2);
  }
  function blush(t,x1,x2,y){return t.blush?`<circle cx="${x1}" cy="${y}" r="3" fill="hsl(${t.hue},85%,75%)" opacity=".65"/><circle cx="${x2}" cy="${y}" r="3" fill="hsl(${t.hue},85%,75%)" opacity=".65"/>`:'';}
  function mark(t,cx,cy,sc){sc=sc||1;
    if(t.pattern==='spots')return `<circle cx="${cx-7*sc}" cy="${cy}" r="${2.4*sc}" fill="${t.acc}" opacity=".8"/><circle cx="${cx+6*sc}" cy="${cy+4*sc}" r="${2*sc}" fill="${t.acc}" opacity=".8"/><circle cx="${cx+2*sc}" cy="${cy-5*sc}" r="${1.7*sc}" fill="${t.acc}" opacity=".8"/>`;
    if(t.pattern==='stripes')return `<path d="M${cx-10*sc} ${cy} h${20*sc}" stroke="${t.acc}" stroke-width="${2*sc}" opacity=".6"/><path d="M${cx-8*sc} ${cy+6*sc} h${16*sc}" stroke="${t.acc}" stroke-width="${2*sc}" opacity=".6"/>`;
    if(t.pattern==='patches')return `<ellipse cx="${cx+5*sc}" cy="${cy-2*sc}" rx="${6*sc}" ry="${5*sc}" fill="${t.acc}" opacity=".5"/>`;
    return '';
  }
  function accessory(t,x,y){const a=t.accessory;
    if(a==='crown')return `<path d="M${x-11} ${y} l4 -10 4 6 4 -10 4 10 4 -6 4 10z" fill="#FFD43B" stroke="#E6A700" stroke-width="1"/>`;
    if(a==='bow')return `<g transform="translate(${x},${y})"><path d="M0 0 l-9 -5 0 10z" fill="${t.acc}"/><path d="M0 0 l9 -5 0 10z" fill="${t.acc}"/><circle r="3" fill="${t.acc}" stroke="#fff" stroke-width="1"/></g>`;
    if(a==='hat')return `<g transform="translate(${x},${y})"><path d="M-10 2 h20 l-5 -13 -10 0z" fill="${t.acc}"/><circle cx="5" cy="-11" r="2.4" fill="#fff"/></g>`;
    if(a==='leaf')return `<path d="M${x} ${y+2} q-10 -10 0 -16 q10 6 0 16z" fill="hsl(110,55%,48%)"/>`;
    if(a==='flower')return `<g transform="translate(${x},${y-4})">${[0,72,144,216,288].map(d=>`<circle cx="${(6*Math.cos(d*Math.PI/180)).toFixed(1)}" cy="${(6*Math.sin(d*Math.PI/180)).toFixed(1)}" r="3.3" fill="hsl(${(t.hue+180)%360},80%,76%)"/>`).join('')}<circle r="2.8" fill="#FFC24B"/></g>`;
    return '';
  }
  const ARCH={
    frog(t){return [`<ellipse cx="50" cy="64" rx="30" ry="23" fill="${t.body}"/><ellipse cx="50" cy="71" rx="17" ry="12" fill="${t.belly}"/>${mark(t,50,62,1)}<circle cx="36" cy="40" r="10" fill="${t.body}"/><circle cx="64" cy="40" r="10" fill="${t.body}"/>${eyes(t,36,64,40,1)}${blush(t,30,70,58)}`,50,30];},
    duck(t){return [`<ellipse cx="48" cy="66" rx="27" ry="19" fill="${t.body}"/><path d="M26 66 q-13 5 -2 13" stroke="${t.body}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="66" cy="46" r="15" fill="${t.body}"/><path d="M79 46 l15 4 -15 6z" fill="hsl(35,85%,55%)"/>${mark(t,46,66,1)}${eyes(t,63,70,42,0.85)}${blush(t,60,73,51)}`,66,31];},
    turtle(t){return [`<ellipse cx="50" cy="62" rx="30" ry="21" fill="${t.bodyD}"/><ellipse cx="50" cy="60" rx="22" ry="15" fill="${t.body}"/>${mark(t,50,60,1)}<ellipse cx="30" cy="78" rx="6" ry="4" fill="${t.body}"/><ellipse cx="68" cy="80" rx="6" ry="4" fill="${t.body}"/><circle cx="80" cy="60" r="9" fill="${t.body}"/>${eyes(t,79,84,58,0.65)}`,50,42];},
    koi(t){return [`<path d="M70 58 l20 -13 0 26z" fill="${t.acc}"/><ellipse cx="46" cy="58" rx="30" ry="15" fill="${t.body}"/>${mark(t,46,56,1)}<path d="M40 45 q6 -7 12 0" fill="none" stroke="${t.acc}" stroke-width="4"/><circle cx="30" cy="56" r="2.4" fill="#2a2a2a"/>`,46,44];},
    snail(t){return [`<ellipse cx="26" cy="76" rx="17" ry="8" fill="${t.body}"/><path d="M16 72 v-12 M22 72 v-14" stroke="${t.body}" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="56" r="16" fill="${t.bodyD}"/><circle cx="52" cy="56" r="11" fill="${t.body}"/><circle cx="52" cy="56" r="5" fill="${t.bodyD}"/><circle cx="15" cy="74" r="2" fill="#2a2a2a"/>${blush(t,12,40,74)}`,52,42];},
    cat(t){return [`<ellipse cx="50" cy="70" rx="20" ry="15" fill="${t.body}"/><circle cx="50" cy="48" r="18" fill="${t.body}"/><path d="M36 38 l-3 -13 12 7z" fill="${t.body}"/><path d="M64 38 l3 -13 -12 7z" fill="${t.body}"/>${mark(t,50,70,0.8)}${eyes(t,43,57,48,0.9)}<path d="M50 53 l-3 3 3 1 3 -1z" fill="${t.acc}"/>${blush(t,38,62,55)}`,50,24];},
    bunny(t){return [`<ellipse cx="50" cy="70" rx="18" ry="14" fill="${t.body}"/><circle cx="50" cy="50" r="16" fill="${t.body}"/><ellipse cx="42" cy="26" rx="6" ry="16" fill="${t.body}"/><ellipse cx="58" cy="26" rx="6" ry="16" fill="${t.body}"/><ellipse cx="42" cy="26" rx="3" ry="11" fill="${t.belly}"/><ellipse cx="58" cy="26" rx="3" ry="11" fill="${t.belly}"/>${eyes(t,44,56,50,0.9)}${blush(t,39,61,56)}`,50,10];},
    bear(t){return [`<ellipse cx="50" cy="70" rx="20" ry="15" fill="${t.body}"/><circle cx="50" cy="48" r="18" fill="${t.body}"/><circle cx="35" cy="34" r="7" fill="${t.body}"/><circle cx="65" cy="34" r="7" fill="${t.body}"/><ellipse cx="50" cy="54" rx="9" ry="7" fill="${t.belly}"/>${eyes(t,43,57,46,0.85)}<circle cx="50" cy="52" r="2.4" fill="#2a2a2a"/>${blush(t,37,63,53)}`,50,26];},
    owl(t){return [`<ellipse cx="50" cy="58" rx="24" ry="27" fill="${t.body}"/><path d="M30 36 l-2 -13 11 9z" fill="${t.body}"/><path d="M70 36 l2 -13 -11 9z" fill="${t.body}"/><circle cx="40" cy="50" r="9" fill="#fff"/><circle cx="60" cy="50" r="9" fill="#fff"/><circle cx="40" cy="50" r="4" fill="#2a2a2a"/><circle cx="60" cy="50" r="4" fill="#2a2a2a"/><path d="M50 56 l-4 5 8 0z" fill="hsl(35,85%,55%)"/>${mark(t,50,72,0.7)}`,50,24];},
    fox(t){return [`<ellipse cx="50" cy="66" rx="19" ry="14" fill="${t.body}"/><path d="M32 56 l-6 -19 17 9z" fill="${t.body}"/><path d="M68 56 l6 -19 -17 9z" fill="${t.body}"/><path d="M34 50 q16 -12 32 0 q-4 18 -16 22 q-12 -4 -16 -22z" fill="${t.body}"/><path d="M42 64 q8 8 16 0 l-8 7z" fill="${t.belly}"/>${eyes(t,43,57,54,0.8)}<circle cx="50" cy="67" r="2.3" fill="#2a2a2a"/>`,50,34];},
    bee(t){return [`<ellipse cx="50" cy="60" rx="20" ry="15" fill="hsl(45,90%,60%)"/><path d="M44 47 v26" stroke="#3a2e10" stroke-width="4"/><path d="M56 47 v26" stroke="#3a2e10" stroke-width="4"/><ellipse cx="35" cy="50" rx="10" ry="7" fill="#fff" opacity=".7"/><ellipse cx="65" cy="50" rx="10" ry="7" fill="#fff" opacity=".7"/><circle cx="50" cy="44" r="9" fill="#3a2e10"/><circle cx="46" cy="43" r="1.7" fill="#fff"/><circle cx="54" cy="43" r="1.7" fill="#fff"/>`,50,33];},
    crab(t){return [`<ellipse cx="50" cy="60" rx="24" ry="16" fill="${t.body}"/><path d="M22 58 q-12 -2 -14 -12 q8 0 12 6z" fill="${t.body}"/><path d="M78 58 q12 -2 14 -12 q-8 0 -12 6z" fill="${t.body}"/><path d="M32 72 l-8 7 M42 76 l-4 8 M58 76 l4 8 M68 72 l8 7" stroke="${t.body}" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="46" r="6" fill="${t.body}"/><circle cx="64" cy="46" r="6" fill="${t.body}"/><circle cx="36" cy="45" r="2.3" fill="#2a2a2a"/><circle cx="64" cy="45" r="2.3" fill="#2a2a2a"/>${mark(t,50,60,0.8)}`,50,40];},
    axolotl(t){return [`<ellipse cx="50" cy="64" rx="22" ry="14" fill="${t.body}"/><circle cx="50" cy="50" r="15" fill="${t.body}"/><g stroke="${t.acc}" stroke-width="4" stroke-linecap="round"><path d="M36 44 l-10 -6"/><path d="M35 50 l-12 0"/><path d="M36 56 l-10 6"/><path d="M64 44 l10 -6"/><path d="M65 50 l12 0"/><path d="M64 56 l10 6"/></g><circle cx="44" cy="50" r="2.3" fill="#2a2a2a"/><circle cx="56" cy="50" r="2.3" fill="#2a2a2a"/>${blush(t,40,60,55)}`,50,34];},
    penguin(t){return [`<ellipse cx="50" cy="58" rx="20" ry="26" fill="${t.bodyD}"/><ellipse cx="50" cy="62" rx="13" ry="20" fill="${t.belly}"/><path d="M30 56 q-8 6 -2 16" stroke="${t.bodyD}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M70 56 q8 6 2 16" stroke="${t.bodyD}" stroke-width="7" fill="none" stroke-linecap="round"/>${eyes(t,44,56,44,0.8)}<path d="M50 48 l-4 5 8 0z" fill="hsl(35,85%,55%)"/>`,50,30];},
    mushroom(t){return [`<rect x="42" y="56" width="16" height="22" rx="8" fill="${t.belly}"/><path d="M22 56 q4 -28 28 -28 q24 0 28 28z" fill="${t.body}"/><circle cx="38" cy="44" r="3" fill="#fff" opacity=".85"/><circle cx="58" cy="40" r="4" fill="#fff" opacity=".85"/><circle cx="50" cy="50" r="2.5" fill="#fff" opacity=".85"/><circle cx="44" cy="66" r="2.2" fill="#2a2a2a"/><circle cx="56" cy="66" r="2.2" fill="#2a2a2a"/>${blush(t,40,60,70)}`,50,26];},
    slime(t){return [`<path d="M24 74 q-2 -34 26 -34 q28 0 26 34z" fill="${t.body}" opacity=".92"/><ellipse cx="40" cy="50" rx="5" ry="7" fill="#fff" opacity=".5"/>${eyes(t,44,58,58,0.9)}<path d="M46 66 q5 4 9 0" stroke="#2a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>${blush(t,38,64,62)}`,50,38];},
    chick(t){return [`<circle cx="50" cy="58" r="20" fill="hsl(48,92%,66%)"/><path d="M50 56 l-5 5 10 0z" fill="hsl(30,85%,55%)"/><circle cx="43" cy="52" r="2.5" fill="#2a2a2a"/><circle cx="57" cy="52" r="2.5" fill="#2a2a2a"/><path d="M47 38 l3 -7 3 7z" fill="hsl(30,85%,55%)"/>${blush(t,37,63,58)}`,50,32];},
    ladybug(t){return [`<ellipse cx="50" cy="60" rx="24" ry="20" fill="${t.acc}"/><path d="M50 40 v40" stroke="#2a2a2a" stroke-width="2"/><circle cx="50" cy="38" r="9" fill="#2a2a2a"/><circle cx="40" cy="55" r="3.4" fill="#2a2a2a"/><circle cx="60" cy="55" r="3.4" fill="#2a2a2a"/><circle cx="42" cy="68" r="3" fill="#2a2a2a"/><circle cx="58" cy="68" r="3" fill="#2a2a2a"/><circle cx="46" cy="36" r="1.7" fill="#fff"/><circle cx="54" cy="36" r="1.7" fill="#fff"/>`,50,28];}
  };
  const KEYS=Object.keys(ARCH);
  function render(seed,archetype,rarity){
    rarity=rarity||0;
    const t=traits(seed,rarity);
    if(!ARCH[archetype])archetype=KEYS[hash(seed)%KEYS.length];
    const out=ARCH[archetype](t), inner=out[0], ax=out[1], ay=out[2];
    let aura='';
    if(rarity===1)aura=`<circle cx="50" cy="56" r="47" fill="hsl(${t.hue2},80%,62%,.16)"/>`;
    else if(rarity===2)aura=`<circle cx="50" cy="56" r="47" fill="hsl(${t.hue2},80%,62%,.12)"/><circle cx="50" cy="56" r="46" fill="none" stroke="hsl(${t.hue2},85%,58%,.55)" stroke-width="2" stroke-dasharray="3 5"/>`;
    else if(rarity>=3)aura=`<circle cx="50" cy="56" r="47" fill="hsl(45,90%,60%,.18)"/><circle cx="50" cy="56" r="46" fill="none" stroke="hsl(45,90%,55%,.7)" stroke-width="2.5"/>`;
    return `<svg viewBox="0 0 100 100" width="100%" height="100%">${aura}${inner}${accessory(t,ax,ay)}</svg>`;
  }
  return {render,list:KEYS,randomArchetype:()=>KEYS[Math.floor(Math.random()*KEYS.length)],
    name:k=>k.charAt(0).toUpperCase()+k.slice(1),
    rarityName:n=>['Common','Uncommon','Rare','Legendary'][n]||'Common'};
});

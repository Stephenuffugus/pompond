/* ============================================================
   CRITTER ENGINE  — canonical, self-contained, DETERMINISTIC.
   render(seed, archetype, rarity) -> SVG string (viewBox 0 0 100 100).
   Same seed -> same critter, forever. Add a species = add ONE
   function to ARCH (append only — never alter an existing one or
   every kid's existing pond changes).

   Dual-mode: usable inline in the browser build AND require()-able
   from Cloud Functions (Node) so the server can mint critters with
   identical output. Do NOT call Math.random / Date inside the render
   path — every random value must come from the seeded rng. The ONLY
   permitted Math.random is in randomArchetype() (mint-time only).
   ============================================================ */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  root.CritterEngine = mod;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let s=hash(seed);return()=>{s=Math.imul(s^(s>>>15),2246822507);s=Math.imul(s^(s>>>13),3266489909);return((s^(s>>>16))>>>0)/4294967296;};}
  const pick=(r,a)=>a[Math.floor(r()*a.length)];
  const f1=n=>(Math.round(n*10)/10);

  // Species-appropriate palettes: [hueLo,hueHi,satLo,satHi]. Hues still vary
  // WITHIN the range so drops feel unique, but a fox reads orange, a frog green,
  // etc. Species not listed keep a fully-random hue (good for the fantastical /
  // abstract ones: slime, dragon, butterfly, koi, octopus…).
  const PAL={
    frog:[95,150,52,68], turtle:[100,150,46,64], newt:[95,140,50,66], tadpole:[100,150,45,62], lizard:[95,145,50,66],
    fox:[18,34,72,86], bear:[24,36,40,55], owl:[26,42,40,56], hedgehog:[26,40,34,50],
    hamster:[28,42,40,56], mouse:[28,44,24,42], otter:[22,36,46,62], beaver:[20,34,46,62], fawn:[28,40,52,66],
    penguin:[210,228,16,30], heron:[200,222,14,30],
    duck:[44,54,76,90], chick:[44,54,82,94], mushroom:[352,372,64,80], starfish:[340,372,66,82],
    seahorse:[18,46,66,82], bunny:[300,340,30,46], cat:[18,40,40,58], snail:[30,300,40,62]
  };
  function traits(seed,rarity,arch){
    const r=rng(seed);
    const uid=(hash(seed)%100000).toString(36); // unique per-render id fragment for gradient defs
    const p=PAL[arch];
    const hue=p ? Math.floor(((p[0]+r()*(p[1]-p[0]))%360+360)%360) : Math.floor(r()*360);
    const harm=pick(r,[26,150,180,205,330,42]);
    const hue2=(hue+harm)%360;
    const sat=p ? p[2]+Math.floor(r()*(p[3]-p[2])) : 58+Math.floor(r()*12);
    const t={
      uid, hue, hue2, harm,
      body:`hsl(${hue},${sat}%,62%)`,
      bodyD:`hsl(${hue},${sat-8}%,47%)`,
      bodyL:`hsl(${hue},${sat+10}%,74%)`,
      belly:`hsl(${hue},${Math.min(sat+18,92)}%,88%)`,
      acc:`hsl(${hue2},72%,56%)`,
      accD:`hsl(${hue2},66%,44%)`,
      line:`hsl(${hue},45%,28%)`,
      pattern:pick(r,['plain','plain','spots','stripes','patches','freckles','ombre']),
      eyeStyle:pick(r,['round','round','big','sleepy','wink','sparkle','happy']),
      blush:r()<0.55,
      r
    };
    if(rarity>=3)t.accessory='crown';
    else if(rarity>=2)t.accessory=pick(r,['bow','flower','hat','star','headphones']);
    else if(rarity>=1)t.accessory=(r()<0.32)?pick(r,['bow','flower','hat','leaf','scarf']):'none';
    else t.accessory=(r()<0.10)?pick(r,['bow','flower','leaf']):'none';
    // ---- variety axes on a SEPARATE rng so the main stream (which the body draw
    //      and sparkles keep consuming after this) is untouched → existing critters
    //      render identically; only shiny ones add a rim + sparkles. ----
    const r2=rng(seed+'~v2');
    t.bg=pick(r2,['none','none','none','none','none','none','bubbles','sky','meadow','sunset']); // showcase views only
    t.shiny=r2()<0.05;   // ~1 in 20 — a coveted iridescent variant (shows everywhere)
    t.r2=r2;
    return t;
  }

  // soft body gradient def (cheap radial); returns {def, fill}
  function bodyGrad(t,suffix){
    const id='g'+t.uid+(suffix||'');
    const def=`<radialGradient id="${id}" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="${t.bodyL}"/><stop offset="60%" stop-color="${t.body}"/><stop offset="100%" stop-color="${t.bodyD}"/></radialGradient>`;
    return {def, fill:`url(#${id})`};
  }

  function eyes(t,x1,x2,y,sz){
    sz=sz||1; const s=t.eyeStyle;
    const dot=x=>`<circle cx="${x}" cy="${y}" r="${f1(2.7*sz)}" fill="#2c2622"/><circle cx="${f1(x-0.9*sz)}" cy="${f1(y-0.9*sz)}" r="${f1(0.9*sz)}" fill="#fff"/>`;
    const curve=x=>`<path d="M${f1(x-4*sz)} ${y} q${f1(4*sz)} ${f1(4*sz)} ${f1(8*sz)} 0" stroke="#2c2622" stroke-width="${f1(1.9*sz)}" fill="none" stroke-linecap="round"/>`;
    const happy=x=>`<path d="M${f1(x-4*sz)} ${f1(y+1.5*sz)} q${f1(4*sz)} ${f1(-5*sz)} ${f1(8*sz)} 0" stroke="#2c2622" stroke-width="${f1(1.9*sz)}" fill="none" stroke-linecap="round"/>`;
    if(s==='sleepy')return curve(x1)+curve(x2);
    if(s==='happy')return happy(x1)+happy(x2);
    if(s==='wink')return dot(x1)+curve(x2);
    if(s==='big'){const e=x=>`<circle cx="${x}" cy="${y}" r="${f1(4.6*sz)}" fill="#fff"/><circle cx="${x}" cy="${f1(y+0.6*sz)}" r="${f1(3*sz)}" fill="#2c2622"/><circle cx="${f1(x+1.5*sz)}" cy="${f1(y-1.5*sz)}" r="${f1(1.3*sz)}" fill="#fff"/><circle cx="${f1(x-1.3*sz)}" cy="${f1(y+1.6*sz)}" r="${f1(0.7*sz)}" fill="#fff" opacity=".8"/>`;return e(x1)+e(x2);}
    if(s==='sparkle'){const e=x=>`<circle cx="${x}" cy="${y}" r="${f1(3.6*sz)}" fill="#2c2622"/><circle cx="${f1(x-1.2*sz)}" cy="${f1(y-1.2*sz)}" r="${f1(1.2*sz)}" fill="#fff"/><circle cx="${f1(x+1.4*sz)}" cy="${f1(y+1.2*sz)}" r="${f1(0.7*sz)}" fill="#fff"/>`;return e(x1)+e(x2);}
    return dot(x1)+dot(x2);
  }
  function blush(t,x1,x2,y){return t.blush?`<ellipse cx="${x1}" cy="${y}" rx="3.2" ry="2.2" fill="hsl(${t.hue},88%,72%)" opacity=".6"/><ellipse cx="${x2}" cy="${y}" rx="3.2" ry="2.2" fill="hsl(${t.hue},88%,72%)" opacity=".6"/>`:'';}
  function smile(x,y,w){return `<path d="M${f1(x-w)} ${y} q${w} ${f1(w*0.9)} ${f1(2*w)} 0" stroke="#2c2622" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;}

  function mark(t,cx,cy,sc){sc=sc||1; const a=t.acc;
    if(t.pattern==='spots')return `<circle cx="${f1(cx-7*sc)}" cy="${cy}" r="${f1(2.4*sc)}" fill="${a}" opacity=".82"/><circle cx="${f1(cx+6*sc)}" cy="${f1(cy+4*sc)}" r="${f1(2*sc)}" fill="${a}" opacity=".82"/><circle cx="${f1(cx+2*sc)}" cy="${f1(cy-5*sc)}" r="${f1(1.7*sc)}" fill="${a}" opacity=".82"/>`;
    if(t.pattern==='stripes')return `<path d="M${f1(cx-10*sc)} ${cy} h${f1(20*sc)}" stroke="${a}" stroke-width="${f1(2*sc)}" opacity=".55" stroke-linecap="round"/><path d="M${f1(cx-8*sc)} ${f1(cy+6*sc)} h${f1(16*sc)}" stroke="${a}" stroke-width="${f1(2*sc)}" opacity=".55" stroke-linecap="round"/>`;
    if(t.pattern==='patches')return `<ellipse cx="${f1(cx+5*sc)}" cy="${f1(cy-2*sc)}" rx="${f1(6*sc)}" ry="${f1(5*sc)}" fill="${a}" opacity=".42"/>`;
    if(t.pattern==='freckles')return `<circle cx="${f1(cx-6*sc)}" cy="${cy}" r="${f1(0.9*sc)}" fill="${t.accD}" opacity=".7"/><circle cx="${f1(cx-3*sc)}" cy="${f1(cy+1*sc)}" r="${f1(0.9*sc)}" fill="${t.accD}" opacity=".7"/><circle cx="${f1(cx+4*sc)}" cy="${cy}" r="${f1(0.9*sc)}" fill="${t.accD}" opacity=".7"/><circle cx="${f1(cx+7*sc)}" cy="${f1(cy+1*sc)}" r="${f1(0.9*sc)}" fill="${t.accD}" opacity=".7"/>`;
    if(t.pattern==='ombre')return `<ellipse cx="${cx}" cy="${f1(cy+5*sc)}" rx="${f1(13*sc)}" ry="${f1(7*sc)}" fill="${a}" opacity=".28"/>`;
    return '';
  }

  function accessory(t,x,y){const a=t.accessory;
    if(a==='crown')return `<g><path d="M${x-11} ${y} l4 -10 4 6 4 -10 4 10 4 -6 4 10z" fill="#FFD43B" stroke="#E6A700" stroke-width="1"/><circle cx="${x-7}" cy="${y-9}" r="1.4" fill="#fff"/><circle cx="${x+1}" cy="${y-10}" r="1.4" fill="#FF6B9D"/><circle cx="${x+9}" cy="${y-9}" r="1.4" fill="#6BCBFF"/></g>`;
    if(a==='bow')return `<g transform="translate(${x},${y})"><path d="M0 0 l-9 -5 0 10z" fill="${t.acc}"/><path d="M0 0 l9 -5 0 10z" fill="${t.acc}"/><path d="M-9 -5 l3 5 -3 5z" fill="${t.accD}"/><path d="M9 -5 l-3 5 3 5z" fill="${t.accD}"/><circle r="3" fill="${t.acc}" stroke="#fff" stroke-width="1"/></g>`;
    if(a==='hat')return `<g transform="translate(${x},${y})"><path d="M-11 3 h22 l-6 -15 -10 0z" fill="${t.acc}"/><path d="M-11 3 h22" stroke="${t.accD}" stroke-width="2"/><circle cx="6" cy="-12" r="2.6" fill="#fff"/></g>`;
    if(a==='leaf')return `<g transform="translate(${x},${y})"><path d="M0 2 q-10 -10 0 -16 q10 6 0 16z" fill="hsl(120,52%,46%)"/><path d="M0 2 v-15" stroke="hsl(120,45%,34%)" stroke-width="1"/></g>`;
    if(a==='scarf')return `<g transform="translate(${x},${y})"><path d="M-14 0 q14 8 28 0 l0 5 q-14 7 -28 0z" fill="${t.acc}"/><path d="M10 4 l3 12 4 -2 -2 -11z" fill="${t.accD}"/></g>`;
    if(a==='star')return `<g transform="translate(${x},${y})">${star(0,0,4.5,'#FFD43B')}</g>`;
    if(a==='headphones')return `<g transform="translate(${x},${y})"><path d="M-16 6 a16 16 0 0 1 32 0" fill="none" stroke="#444" stroke-width="2.5"/><rect x="-19" y="4" width="6" height="9" rx="2" fill="${t.acc}"/><rect x="13" y="4" width="6" height="9" rx="2" fill="${t.acc}"/></g>`;
    if(a==='flower')return `<g transform="translate(${x},${y-3})">${[0,72,144,216,288].map(d=>`<circle cx="${f1(6*Math.cos(d*Math.PI/180))}" cy="${f1(6*Math.sin(d*Math.PI/180))}" r="3.3" fill="hsl(${(t.hue+180)%360},80%,76%)"/>`).join('')}<circle r="2.8" fill="#FFC24B"/></g>`;
    return '';
  }

  function star(cx,cy,rad,fill){let p='';for(let i=0;i<10;i++){const ang=Math.PI/2+i*Math.PI/5;const rr=i%2?rad*0.45:rad;p+=(i?'L':'M')+f1(cx+rr*Math.cos(ang))+' '+f1(cy-rr*Math.sin(ang))+' ';}return `<path d="${p}Z" fill="${fill}"/>`;}

  // shared soft contact shadow
  function shadow(cx,cy,rx){return `<ellipse cx="${cx}" cy="${cy||90}" rx="${rx||26}" ry="5" fill="#000" opacity=".10"/>`;}

  /* ============================================================
     COMPOSABLE PARTS — build many NEW species from tiny data specs.
     Used ONLY for new (appended) species; the 40 bespoke ones above are
     untouched. Variety = shape × ears × tail × nose, combined with the
     per-seed palette/pattern/eyes the trait system already provides.
     ============================================================ */
  function pEars(type,t,g,cx,ty,sp){const f=g.fill,ic=t.belly;
    if(type==='round')return `<circle cx="${f1(cx-sp)}" cy="${ty}" r="6.2" fill="${f}"/><circle cx="${f1(cx+sp)}" cy="${ty}" r="6.2" fill="${f}"/><circle cx="${f1(cx-sp)}" cy="${f1(ty+1)}" r="3" fill="${ic}"/><circle cx="${f1(cx+sp)}" cy="${f1(ty+1)}" r="3" fill="${ic}"/>`;
    if(type==='pointy')return `<path d="M${f1(cx-sp-3)} ${f1(ty+5)} l-1 -13 10 7z" fill="${f}"/><path d="M${f1(cx+sp+3)} ${f1(ty+5)} l1 -13 -10 7z" fill="${f}"/><path d="M${f1(cx-sp-1)} ${f1(ty+3)} l-1 -7 5 4z" fill="${ic}"/><path d="M${f1(cx+sp+1)} ${f1(ty+3)} l1 -7 -5 4z" fill="${ic}"/>`;
    if(type==='long')return `<ellipse cx="${f1(cx-sp+2)}" cy="${f1(ty-9)}" rx="4.6" ry="15" fill="${f}"/><ellipse cx="${f1(cx+sp-2)}" cy="${f1(ty-9)}" rx="4.6" ry="15" fill="${f}"/><ellipse cx="${f1(cx-sp+2)}" cy="${f1(ty-8)}" rx="2.2" ry="10" fill="${ic}"/><ellipse cx="${f1(cx+sp-2)}" cy="${f1(ty-8)}" rx="2.2" ry="10" fill="${ic}"/>`;
    if(type==='tuft')return `<path d="M${f1(cx-sp-1)} ${ty} l-2 -11 9 7z" fill="${f}"/><path d="M${f1(cx+sp+1)} ${ty} l2 -11 -9 7z" fill="${f}"/>`;
    if(type==='floppy')return `<ellipse cx="${f1(cx-sp-3)}" cy="${f1(ty+6)}" rx="4.6" ry="10" fill="${f}" transform="rotate(22 ${f1(cx-sp-3)} ${f1(ty+6)})"/><ellipse cx="${f1(cx+sp+3)}" cy="${f1(ty+6)}" rx="4.6" ry="10" fill="${f}" transform="rotate(-22 ${f1(cx+sp+3)} ${f1(ty+6)})"/>`;
    if(type==='horn')return `<path d="M${f1(cx-sp+1)} ${ty} l-1 -9 4 8z" fill="${t.bodyL}"/><path d="M${f1(cx+sp-1)} ${ty} l1 -9 -4 8z" fill="${t.bodyL}"/>`;
    if(type==='fin')return `<path d="M${f1(cx-sp-1)} ${f1(ty+3)} q-8 -7 -1 -11 q4 4 5 10z" fill="${t.acc}" opacity=".85"/><path d="M${f1(cx+sp+1)} ${f1(ty+3)} q8 -7 1 -11 q-4 4 -5 10z" fill="${t.acc}" opacity=".85"/>`;
    return '';}
  function pTail(type,t,g){
    if(type==='fluffy')return `<ellipse cx="74" cy="71" rx="10" ry="9" fill="${g.fill}"/><ellipse cx="76" cy="71" rx="5" ry="5" fill="${t.belly}" opacity=".7"/>`;
    if(type==='thin')return `<path d="M68 73 q16 2 13 -11" stroke="${g.fill}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    if(type==='curl')return `<path d="M69 71 q15 0 12 -9 q-1 -6 -7 -3" stroke="${g.fill}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if(type==='fin')return `<path d="M68 64 l20 -11 0 24z" fill="${t.acc}"/>`;
    if(type==='puff')return `<circle cx="72" cy="73" r="6" fill="#fff" opacity=".92"/>`;
    return '';}
  function pNose(type,t,nx,ny){
    if(type==='dot')return `<ellipse cx="${nx}" cy="${ny}" rx="2.3" ry="1.7" fill="#2c2622"/>`;
    if(type==='snout')return `<ellipse cx="${nx}" cy="${f1(ny+1)}" rx="6" ry="4.5" fill="${t.belly}"/><ellipse cx="${nx}" cy="${ny}" rx="2.1" ry="1.5" fill="#2c2622"/>`;
    if(type==='beak')return `<path d="M${nx} ${f1(ny-1)} l-4 5 8 0z" fill="hsl(35,85%,55%)"/>`;
    if(type==='button')return `<circle cx="${nx}" cy="${ny}" r="2" fill="hsl(330,62%,66%)"/>`;
    return '';}
  function compose(t,s){s=s||{};const g=bodyGrad(t),o=[`<defs>${g.def}</defs>`];let accY=22;const sh=s.shape||'std';
    if(sh==='round'){o.push(shadow(50,88,22),pTail(s.tail,t,g),`<circle cx="50" cy="55" r="24" fill="${g.fill}"/>`);
      if(s.belly)o.push(`<ellipse cx="50" cy="62" rx="13" ry="12" fill="${t.belly}"/>`);
      o.push(mark(t,50,58,0.9),pEars(s.ears,t,g,50,33,13));accY=18;
      o.push(eyes(t,43,57,52,s.eyeSz||0.9),pNose(s.nose,t,50,60),smile(50,64,3.5),blush(t,37,63,60));
    }else if(sh==='tall'){o.push(shadow(50,88,17),pTail(s.tail,t,g),`<ellipse cx="50" cy="58" rx="17" ry="26" fill="${g.fill}"/>`);
      if(s.belly)o.push(`<ellipse cx="50" cy="64" rx="9" ry="16" fill="${t.belly}"/>`);
      o.push(mark(t,50,58,0.85),pEars(s.ears,t,g,50,34,11));accY=17;
      o.push(eyes(t,44,56,48,s.eyeSz||0.85),pNose(s.nose,t,50,55),smile(50,60,3.5),blush(t,40,60,57));
    }else if(sh==='wide'){o.push(shadow(50,86,26),pTail(s.tail,t,g),`<ellipse cx="50" cy="62" rx="26" ry="17" fill="${g.fill}"/>`);
      if(s.belly)o.push(`<ellipse cx="50" cy="66" rx="14" ry="9" fill="${t.belly}"/>`);
      o.push(mark(t,50,60,0.9),pEars(s.ears,t,g,50,48,16));accY=30;
      o.push(eyes(t,42,58,58,s.eyeSz||0.85),pNose(s.nose,t,50,64),smile(50,68,4),blush(t,36,64,63));
    }else{o.push(shadow(50,88,22),pTail(s.tail,t,g),`<ellipse cx="50" cy="70" rx="19" ry="14" fill="${g.fill}"/>`);
      if(s.belly)o.push(`<ellipse cx="50" cy="73" rx="10" ry="9" fill="${t.belly}"/>`);
      o.push(mark(t,50,70,0.85),`<circle cx="50" cy="47" r="16" fill="${g.fill}"/>`,pEars(s.ears,t,g,50,33,11));accY=22;
      o.push(eyes(t,43,57,47,s.eyeSz||0.85),pNose(s.nose,t,50,53),smile(50,56,3.8),blush(t,37,63,53));
    }
    return [o.join(''),50,accY];}

  const ARCH={
    // -------- original keys (kept; restyled) --------
    frog(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,28)}<ellipse cx="50" cy="64" rx="30" ry="23" fill="${g.fill}"/><ellipse cx="50" cy="72" rx="17" ry="11" fill="${t.belly}"/>${mark(t,50,62,1)}<circle cx="35" cy="39" r="11" fill="${g.fill}"/><circle cx="65" cy="39" r="11" fill="${g.fill}"/><circle cx="35" cy="38" r="6.5" fill="#fff"/><circle cx="65" cy="38" r="6.5" fill="#fff"/>${eyes(t,35,65,39,1)}${smile(50,56,5)}${blush(t,30,70,58)}`,50,28];},
    duck(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,26)}<ellipse cx="48" cy="66" rx="27" ry="19" fill="${g.fill}"/><path d="M26 66 q-13 5 -2 13" stroke="${g.fill}" stroke-width="9" fill="none" stroke-linecap="round"/>${mark(t,46,66,1)}<circle cx="66" cy="46" r="16" fill="${g.fill}"/><path d="M80 44 q12 1 13 6 q-12 5 -13 1z" fill="hsl(35,88%,56%)"/>${eyes(t,62,71,42,0.85)}${blush(t,58,75,50)}`,66,29];},
    turtle(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,28)}<ellipse cx="30" cy="80" rx="6" ry="4" fill="${t.bodyD}"/><ellipse cx="68" cy="82" rx="6" ry="4" fill="${t.bodyD}"/><ellipse cx="50" cy="62" rx="30" ry="21" fill="${t.bodyD}"/><ellipse cx="50" cy="60" rx="23" ry="15" fill="${g.fill}"/><path d="M50 45 v30 M30 60 h40" stroke="${t.bodyD}" stroke-width="1.6" opacity=".5"/>${mark(t,50,60,1)}<circle cx="80" cy="60" r="9.5" fill="${g.fill}"/>${eyes(t,78,84,58,0.62)}${blush(t,76,86,63)}`,50,40];},
    koi(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(46,86,26)}<path d="M70 58 l22 -14 0 28z" fill="${t.acc}"/><ellipse cx="44" cy="58" rx="30" ry="15" fill="${g.fill}"/><ellipse cx="50" cy="51" rx="9" ry="5" fill="${t.acc}" opacity=".75"/>${mark(t,44,56,1)}<path d="M38 44 q7 -7 13 0" fill="none" stroke="${t.acc}" stroke-width="4" stroke-linecap="round"/><circle cx="29" cy="56" r="2.6" fill="#2c2622"/><circle cx="28" cy="55" r="0.9" fill="#fff"/>`,46,42];},
    snail(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(48,86,28)}<path d="M14 78 q-2 -11 11 -12 l38 0 q13 1 13 12 z" fill="${t.bodyL}"/><circle cx="70" cy="60" r="11" fill="${t.bodyL}"/><path d="M65 50 l-3 -11 M75 50 l3 -11" stroke="${t.bodyL}" stroke-width="2.6" stroke-linecap="round"/><circle cx="62" cy="38" r="2.6" fill="${t.acc}"/><circle cx="78" cy="38" r="2.6" fill="${t.acc}"/><circle cx="44" cy="52" r="21" fill="${t.bodyD}"/><circle cx="44" cy="52" r="16" fill="${g.fill}"/><circle cx="44" cy="52" r="10" fill="${t.bodyD}"/><circle cx="44" cy="52" r="4.5" fill="${g.fill}"/>${eyes(t,66,75,60,0.7)}${smile(70,65,3)}${blush(t,62,78,64)}`,44,34];},
    cat(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,22)}<ellipse cx="50" cy="70" rx="20" ry="15" fill="${g.fill}"/><circle cx="50" cy="47" r="18" fill="${g.fill}"/><path d="M36 36 l-3 -14 13 8z" fill="${g.fill}"/><path d="M64 36 l3 -14 -13 8z" fill="${g.fill}"/><path d="M37 34 l-1 -7 6 4z" fill="${t.belly}"/><path d="M63 34 l1 -7 -6 4z" fill="${t.belly}"/>${mark(t,50,70,0.8)}${eyes(t,43,57,47,0.9)}<path d="M50 52 l-2.5 2.5 2.5 1 2.5 -1z" fill="${t.acc}"/><path d="M44 50 q-7 1 -10 -1 M56 50 q7 1 10 -1" stroke="#2c2622" stroke-width="0.8" fill="none" opacity=".5"/>${blush(t,38,62,55)}`,50,22];},
    bunny(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,20)}<ellipse cx="50" cy="70" rx="18" ry="14" fill="${g.fill}"/><circle cx="50" cy="50" r="16" fill="${g.fill}"/><ellipse cx="42" cy="25" rx="6" ry="17" fill="${g.fill}"/><ellipse cx="58" cy="25" rx="6" ry="17" fill="${g.fill}"/><ellipse cx="42" cy="26" rx="3" ry="12" fill="hsl(${t.hue},80%,90%)"/><ellipse cx="58" cy="26" rx="3" ry="12" fill="hsl(${t.hue},80%,90%)"/>${eyes(t,44,56,50,0.9)}<path d="M50 55 l-2 2 2 .8 2 -.8z" fill="${t.acc}"/>${blush(t,39,61,56)}`,50,8];},
    bear(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,22)}<ellipse cx="50" cy="70" rx="20" ry="15" fill="${g.fill}"/><circle cx="50" cy="48" r="18" fill="${g.fill}"/><circle cx="35" cy="33" r="7.5" fill="${g.fill}"/><circle cx="65" cy="33" r="7.5" fill="${g.fill}"/><circle cx="35" cy="33" r="3.5" fill="${t.belly}"/><circle cx="65" cy="33" r="3.5" fill="${t.belly}"/><ellipse cx="50" cy="55" rx="9" ry="7" fill="${t.belly}"/>${eyes(t,43,57,46,0.85)}<ellipse cx="50" cy="52" rx="2.6" ry="2" fill="#2c2622"/>${smile(50,57,4)}${blush(t,37,63,53)}`,50,24];},
    owl(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,24)}<ellipse cx="50" cy="58" rx="24" ry="28" fill="${g.fill}"/><ellipse cx="50" cy="66" rx="14" ry="16" fill="${t.belly}" opacity=".6"/><path d="M30 35 l-2 -14 12 10z" fill="${g.fill}"/><path d="M70 35 l2 -14 -12 10z" fill="${g.fill}"/>${mark(t,50,70,0.6)}<circle cx="40" cy="50" r="10" fill="#fff"/><circle cx="60" cy="50" r="10" fill="#fff"/><circle cx="40" cy="50" r="4.5" fill="#2c2622"/><circle cx="60" cy="50" r="4.5" fill="#2c2622"/><circle cx="38" cy="48" r="1.5" fill="#fff"/><circle cx="58" cy="48" r="1.5" fill="#fff"/><path d="M50 55 l-4 5 8 0z" fill="hsl(35,85%,55%)"/>`,50,22];},
    fox(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,22)}<ellipse cx="50" cy="66" rx="19" ry="14" fill="${g.fill}"/><path d="M32 55 l-7 -20 18 10z" fill="${g.fill}"/><path d="M68 55 l7 -20 -18 10z" fill="${g.fill}"/><path d="M34 32 l-1 -8 7 5z" fill="#2c2622" opacity=".6"/><path d="M66 32 l1 -8 -7 5z" fill="#2c2622" opacity=".6"/><path d="M34 48 q16 -12 32 0 q-4 18 -16 23 q-12 -5 -16 -23z" fill="${g.fill}"/><path d="M40 62 q10 9 20 0 l-10 8z" fill="${t.belly}"/>${eyes(t,43,53,53,0.8)}<circle cx="50" cy="66" r="2.6" fill="#2c2622"/>${blush(t,38,62,60)}`,50,32];},
    bee(t){return [`${shadow(50,86,22)}<ellipse cx="36" cy="48" rx="11" ry="8" fill="#fff" opacity=".75"/><ellipse cx="64" cy="48" rx="11" ry="8" fill="#fff" opacity=".75"/><ellipse cx="50" cy="60" rx="20" ry="15" fill="hsl(45,92%,60%)"/><path d="M43 47 v26" stroke="#3a2e10" stroke-width="5"/><path d="M57 47 v26" stroke="#3a2e10" stroke-width="5"/><circle cx="50" cy="44" r="10" fill="#3a2e10"/><circle cx="46" cy="42" r="2" fill="#fff"/><circle cx="54" cy="42" r="2" fill="#fff"/><circle cx="46" cy="42.5" r="0.7" fill="#3a2e10"/><circle cx="54" cy="42.5" r="0.7" fill="#3a2e10"/><path d="M45 36 q-2 -5 -5 -6 M55 36 q2 -5 5 -6" stroke="#3a2e10" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="40" cy="30" r="1.6" fill="#3a2e10"/><circle cx="60" cy="30" r="1.6" fill="#3a2e10"/>${blush(t,40,60,48)}`,50,31];},
    crab(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,26)}<path d="M30 72 l-9 8 M40 76 l-5 9 M60 76 l5 9 M70 72 l9 8" stroke="${t.bodyD}" stroke-width="3" stroke-linecap="round"/><ellipse cx="50" cy="60" rx="24" ry="16" fill="${g.fill}"/><path d="M22 58 q-13 -3 -15 -13 q9 0 13 7z" fill="${g.fill}"/><path d="M78 58 q13 -3 15 -13 q-9 0 -13 7z" fill="${g.fill}"/>${mark(t,50,60,0.8)}<circle cx="36" cy="45" r="6.5" fill="${g.fill}"/><circle cx="64" cy="45" r="6.5" fill="${g.fill}"/><circle cx="36" cy="45" r="2.6" fill="#2c2622"/><circle cx="64" cy="45" r="2.6" fill="#2c2622"/><circle cx="35" cy="44" r="0.9" fill="#fff"/><circle cx="63" cy="44" r="0.9" fill="#fff"/>${smile(50,63,4)}`,50,38];},
    axolotl(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,22)}<ellipse cx="50" cy="64" rx="22" ry="14" fill="${g.fill}"/><circle cx="50" cy="50" r="15" fill="${g.fill}"/><g stroke="${t.acc}" stroke-width="4" stroke-linecap="round"><path d="M36 43 l-11 -7"/><path d="M35 50 l-13 0"/><path d="M36 57 l-11 7"/><path d="M64 43 l11 -7"/><path d="M65 50 l13 0"/><path d="M64 57 l11 7"/></g><circle cx="44" cy="50" r="2.5" fill="#2c2622"/><circle cx="56" cy="50" r="2.5" fill="#2c2622"/>${smile(50,55,3.5)}${blush(t,40,60,55)}`,50,34];},
    penguin(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,20)}<ellipse cx="50" cy="58" rx="20" ry="27" fill="${t.bodyD}"/><ellipse cx="50" cy="62" rx="13" ry="20" fill="${t.belly}"/><path d="M30 56 q-9 6 -2 17" stroke="${t.bodyD}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M70 56 q9 6 2 17" stroke="${t.bodyD}" stroke-width="8" fill="none" stroke-linecap="round"/><ellipse cx="43" cy="84" rx="5" ry="3" fill="hsl(35,85%,55%)"/><ellipse cx="57" cy="84" rx="5" ry="3" fill="hsl(35,85%,55%)"/>${eyes(t,44,56,44,0.8)}<path d="M50 48 l-4 5 8 0z" fill="hsl(35,85%,55%)"/>${blush(t,40,60,51)}`,50,28];},
    mushroom(t){return [`${shadow(50,84,22)}<rect x="41" y="56" width="18" height="24" rx="9" fill="${t.belly}"/><path d="M21 56 q4 -30 29 -30 q25 0 29 30z" fill="${t.body}"/><path d="M21 56 q4 -30 29 -30 q25 0 29 30z" fill="${t.bodyD}" opacity=".15"/><circle cx="37" cy="43" r="3.4" fill="#fff" opacity=".9"/><circle cx="60" cy="39" r="4.4" fill="#fff" opacity=".9"/><circle cx="51" cy="49" r="2.6" fill="#fff" opacity=".9"/><circle cx="44" cy="66" r="2.3" fill="#2c2622"/><circle cx="56" cy="66" r="2.3" fill="#2c2622"/>${smile(50,71,3.5)}${blush(t,39,61,70)}`,50,24];},
    slime(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,84,24)}<path d="M24 74 q-2 -35 26 -35 q28 0 26 35z" fill="${g.fill}" opacity=".95"/><ellipse cx="40" cy="49" rx="5" ry="8" fill="#fff" opacity=".5"/><circle cx="62" cy="46" r="3" fill="#fff" opacity=".4"/>${eyes(t,44,58,58,0.9)}<path d="M46 66 q5 4 9 0" stroke="#2c2622" stroke-width="2" fill="none" stroke-linecap="round"/>${blush(t,38,64,62)}`,50,38];},
    chick(t){return [`${shadow(50,84,18)}<ellipse cx="50" cy="68" rx="15" ry="11" fill="hsl(48,92%,62%)"/><circle cx="50" cy="52" r="19" fill="hsl(48,94%,68%)"/><path d="M50 52 l-6 5 12 0z" fill="hsl(30,88%,55%)"/><circle cx="43" cy="48" r="2.6" fill="#2c2622"/><circle cx="57" cy="48" r="2.6" fill="#2c2622"/><circle cx="42" cy="47" r="0.9" fill="#fff"/><circle cx="56" cy="47" r="0.9" fill="#fff"/><path d="M46 34 q4 -8 4 0 q4 -7 4 1z" fill="hsl(38,90%,60%)"/>${blush(t,38,62,55)}`,50,30];},
    ladybug(t){return [`${shadow(50,86,24)}<ellipse cx="50" cy="60" rx="24" ry="20" fill="${t.acc}"/><path d="M50 40 v40" stroke="#2c2622" stroke-width="2"/><path d="M26 56 q24 -8 48 0" stroke="#2c2622" stroke-width="1" fill="none" opacity=".4"/><circle cx="50" cy="38" r="9.5" fill="#2c2622"/><circle cx="40" cy="55" r="3.6" fill="#2c2622"/><circle cx="60" cy="55" r="3.6" fill="#2c2622"/><circle cx="42" cy="69" r="3.1" fill="#2c2622"/><circle cx="58" cy="69" r="3.1" fill="#2c2622"/><circle cx="46" cy="36" r="1.8" fill="#fff"/><circle cx="54" cy="36" r="1.8" fill="#fff"/><path d="M44 30 q-2 -5 -6 -6 M56 30 q2 -5 6 -6" stroke="#2c2622" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,50,26];},

    // -------- NEW species --------
    tadpole(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(46,86,22)}<path d="M58 58 q18 -10 24 -2 q-8 4 -6 12 q-12 -2 -18 -10z" fill="${t.bodyD}"/><circle cx="44" cy="58" r="18" fill="${g.fill}"/>${mark(t,44,58,0.8)}${eyes(t,38,50,54,0.85)}${smile(44,62,4)}${blush(t,34,54,60)}`,44,40];},
    dragonfly(t){return [`${shadow(50,88,20)}<ellipse cx="34" cy="42" rx="13" ry="6" fill="${t.acc}" opacity=".55" transform="rotate(-22 34 42)"/><ellipse cx="66" cy="42" rx="13" ry="6" fill="${t.acc}" opacity=".55" transform="rotate(22 66 42)"/><ellipse cx="34" cy="56" rx="11" ry="5" fill="${t.acc}" opacity=".45" transform="rotate(-12 34 56)"/><ellipse cx="66" cy="56" rx="11" ry="5" fill="${t.acc}" opacity=".45" transform="rotate(12 66 56)"/><rect x="46" y="40" width="8" height="42" rx="4" fill="${t.body}"/><path d="M48 50 h4 M48 58 h4 M48 66 h4" stroke="${t.bodyD}" stroke-width="1.4"/><circle cx="50" cy="36" r="9" fill="${t.bodyD}"/><circle cx="46" cy="34" r="3" fill="#2c2622"/><circle cx="54" cy="34" r="3" fill="#2c2622"/><circle cx="45" cy="33" r="1" fill="#fff"/><circle cx="53" cy="33" r="1" fill="#fff"/>`,50,24];},
    butterfly(t){return [`${shadow(50,88,20)}<path d="M50 56 q-26 -22 -34 -4 q-3 14 12 16 q14 1 22 -10z" fill="${t.body}"/><path d="M50 56 q26 -22 34 -4 q3 14 -12 16 q-14 1 -22 -10z" fill="${t.body}"/><path d="M50 58 q-18 18 -26 8 q-2 -10 10 -12 q10 -1 16 4z" fill="${t.acc}"/><path d="M50 58 q18 18 26 8 q2 -10 -10 -12 q-10 -1 -16 4z" fill="${t.acc}"/><circle cx="28" cy="46" r="3" fill="#fff" opacity=".7"/><circle cx="72" cy="46" r="3" fill="#fff" opacity=".7"/><rect x="48" y="46" width="4" height="26" rx="2" fill="#2c2622"/><circle cx="50" cy="44" r="4" fill="#2c2622"/><path d="M47 40 q-3 -6 -6 -6 M53 40 q3 -6 6 -6" stroke="#2c2622" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,50,22];},
    otter(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,20)}<ellipse cx="50" cy="68" rx="17" ry="16" fill="${g.fill}"/><ellipse cx="50" cy="72" rx="10" ry="11" fill="${t.belly}"/><circle cx="50" cy="46" r="15" fill="${g.fill}"/><circle cx="39" cy="36" r="5" fill="${g.fill}"/><circle cx="61" cy="36" r="5" fill="${g.fill}"/><ellipse cx="50" cy="50" rx="8" ry="6" fill="${t.belly}"/>${eyes(t,44,56,45,0.78)}<ellipse cx="50" cy="50" rx="2.4" ry="1.8" fill="#2c2622"/>${smile(50,54,3.5)}${blush(t,38,62,51)}`,50,22];},
    hedgehog(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,24)}<path d="M22 68 q2 -30 28 -30 q26 0 28 30z" fill="${t.bodyD}"/>${[28,36,44,52,60,68,72].map((x,i)=>`<path d="M${x} ${50-(i%2?4:0)} l${i<4?-4:4} -10 4 9z" fill="${t.bodyD}"/>`).join('')}<ellipse cx="50" cy="70" rx="20" ry="11" fill="${g.fill}"/><circle cx="50" cy="72" r="3" fill="#2c2622"/>${eyes(t,42,58,67,0.7)}${blush(t,38,62,72)}`,50,30];},
    hamster(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,22)}<ellipse cx="50" cy="64" rx="23" ry="21" fill="${g.fill}"/><ellipse cx="50" cy="70" rx="13" ry="12" fill="${t.belly}"/><circle cx="36" cy="44" r="6" fill="${g.fill}"/><circle cx="64" cy="44" r="6" fill="${g.fill}"/><circle cx="36" cy="44" r="3" fill="hsl(${t.hue},70%,82%)"/><circle cx="64" cy="44" r="3" fill="hsl(${t.hue},70%,82%)"/>${eyes(t,43,57,56,0.85)}<ellipse cx="50" cy="62" rx="6" ry="4" fill="${t.belly}"/><circle cx="50" cy="60" r="1.8" fill="#2c2622"/>${blush(t,38,62,62)}`,50,20];},
    panda(t){return [`${shadow(50,88,22)}<ellipse cx="50" cy="68" rx="20" ry="16" fill="#fff"/><ellipse cx="50" cy="68" rx="20" ry="16" fill="#000" opacity=".06"/><circle cx="50" cy="48" r="18" fill="#fff"/><circle cx="34" cy="33" r="7" fill="#2c2622"/><circle cx="66" cy="33" r="7" fill="#2c2622"/><ellipse cx="42" cy="48" rx="6" ry="7" fill="#2c2622" transform="rotate(-18 42 48)"/><ellipse cx="58" cy="48" rx="6" ry="7" fill="#2c2622" transform="rotate(18 58 48)"/><circle cx="42" cy="48" r="2.6" fill="#fff"/><circle cx="58" cy="48" r="2.6" fill="#fff"/><circle cx="42" cy="48" r="1.5" fill="#2c2622"/><circle cx="58" cy="48" r="1.5" fill="#2c2622"/><circle cx="50" cy="54" r="2.4" fill="#2c2622"/>${smile(50,58,4)}${blush(t,36,64,56)}`,50,24];},
    octopus(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,26)}${[28,38,50,62,72].map((x,i)=>`<path d="M${x} 62 q${i%2?-6:6} 16 ${i<2?-4:(i>2?4:0)} 22" stroke="${g.fill}" stroke-width="6" fill="none" stroke-linecap="round"/>`).join('')}<circle cx="50" cy="50" r="22" fill="${g.fill}"/>${mark(t,50,46,0.8)}${eyes(t,42,58,48,0.9)}${smile(50,56,4.5)}${blush(t,36,64,54)}`,50,26];},
    seahorse(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(48,88,18)}<path d="M44 24 q18 -1 20 17 q1 13 -9 19 q9 3 10 12 q1 11 -10 11 q-13 0 -12 -12 q1 -7 8 -8 q-10 -4 -11 -18 q-1 -17 6 -22z" fill="${g.fill}"/><path d="M58 44 q9 3 9 12 q-7 -3 -9 -6z" fill="${t.acc}" opacity=".85"/><path d="M40 30 q-9 -3 -11 5 q7 -1 11 -1z" fill="${t.acc}"/><path d="M40 42 q-7 0 -8 6 q5 -2 8 -2z" fill="${t.acc}" opacity=".8"/><path d="M60 30 l13 -3 q3 1 0 4 l-12 3z" fill="${t.accD}"/>${mark(t,46,52,0.7)}<circle cx="52" cy="33" r="3.4" fill="#2c2622"/><circle cx="51" cy="32" r="1.2" fill="#fff"/>${blush(t,46,60,40)}`,50,22];},
    starfish(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,22)}${star(50,54,30,g.fill)}<circle cx="50" cy="54" r="9" fill="${t.belly}" opacity=".5"/>${[0,72,144,216,288].map(d=>`<circle cx="${f1(50+16*Math.cos((d-90)*Math.PI/180))}" cy="${f1(54+16*Math.sin((d-90)*Math.PI/180))}" r="1.6" fill="${t.acc}" opacity=".7"/>`).join('')}${eyes(t,44,56,52,0.78)}${smile(50,58,3.5)}${blush(t,38,62,57)}`,50,18];},
    newt(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,24)}<path d="M74 60 q16 -2 18 6 q-10 4 -16 -1z" fill="${t.bodyD}"/><ellipse cx="50" cy="62" rx="26" ry="13" fill="${g.fill}"/><path d="M26 62 q-6 6 -10 4 M30 70 q-4 7 -9 7 M70 70 q4 7 9 7" stroke="${g.fill}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M30 54 q20 -8 40 0" stroke="${t.acc}" stroke-width="2" fill="none" opacity=".6"/>${mark(t,46,62,0.8)}<circle cx="28" cy="56" r="5" fill="${g.fill}"/><circle cx="26" cy="56" r="2.2" fill="#2c2622"/><circle cx="38" cy="56" r="2.2" fill="#2c2622"/>${blush(t,26,40,61)}`,50,38];},
    heron(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(48,90,16)}<path d="M48 84 v-22 M44 84 v-22" stroke="hsl(38,70%,52%)" stroke-width="2.5"/><ellipse cx="50" cy="56" rx="16" ry="13" fill="${g.fill}"/><path d="M52 46 q4 -22 8 -24 q3 1 1 6 q-2 18 -3 22z" fill="${g.fill}"/><circle cx="60" cy="24" r="7" fill="${g.fill}"/><path d="M66 23 l13 -2 -13 5z" fill="hsl(38,85%,55%)"/><path d="M62 18 q6 -2 9 0" stroke="${t.acc}" stroke-width="1.6" fill="none"/><circle cx="59" cy="23" r="1.8" fill="#2c2622"/>${blush(t,55,66,27)}`,60,16];},
    beaver(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,24)}<ellipse cx="68" cy="74" rx="13" ry="7" fill="${t.bodyD}"/><path d="M62 70 h12 M64 76 h10" stroke="${t.body}" stroke-width="1" opacity=".4"/><ellipse cx="46" cy="62" rx="22" ry="20" fill="${g.fill}"/><ellipse cx="46" cy="68" rx="12" ry="12" fill="${t.belly}"/><circle cx="33" cy="46" r="5" fill="${g.fill}"/><circle cx="59" cy="46" r="5" fill="${g.fill}"/>${eyes(t,40,52,52,0.8)}<ellipse cx="46" cy="60" rx="5" ry="4" fill="${t.bodyD}"/><rect x="43" y="62" width="6" height="6" rx="1" fill="#fff"/><path d="M46 62 v6" stroke="${t.bodyD}" stroke-width="0.6"/>${blush(t,34,58,58)}`,46,22];},
    hummingbird(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,16)}<ellipse cx="36" cy="50" rx="14" ry="7" fill="${t.acc}" opacity=".5" transform="rotate(-25 36 50)"/><ellipse cx="66" cy="50" rx="14" ry="7" fill="${t.acc}" opacity=".5" transform="rotate(25 66 50)"/><ellipse cx="50" cy="58" rx="13" ry="16" fill="${g.fill}"/><path d="M50 72 q-3 12 0 16 q3 -4 0 -16z" fill="${t.bodyD}"/><circle cx="50" cy="44" r="9" fill="${g.fill}"/><path d="M58 44 l16 -3 -16 6z" fill="#2c2622"/>${eyes(t,46,54,42,0.62)}${blush(t,44,56,47)}`,50,26];},
    firefly(t){return [`${shadow(50,88,16)}<circle cx="50" cy="56" r="34" fill="hsl(55,95%,65%)" opacity=".22"/><ellipse cx="38" cy="48" rx="9" ry="6" fill="#fff" opacity=".6" transform="rotate(-20 38 48)"/><ellipse cx="62" cy="48" rx="9" ry="6" fill="#fff" opacity=".6" transform="rotate(20 62 48)"/><ellipse cx="50" cy="58" rx="11" ry="14" fill="${t.bodyD}"/><ellipse cx="50" cy="66" rx="8" ry="8" fill="hsl(55,95%,62%)"/><circle cx="50" cy="66" r="8" fill="hsl(55,100%,70%)" opacity=".5"/><circle cx="50" cy="44" r="8" fill="#3a2e10"/><circle cx="46" cy="42" r="1.8" fill="#fff"/><circle cx="54" cy="42" r="1.8" fill="#fff"/><path d="M46 37 q-2 -5 -5 -6 M54 37 q2 -5 5 -6" stroke="#3a2e10" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,50,24];},
    dragon(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,26)}<path d="M30 58 q-24 -18 -28 1 q8 -3 11 3 q5 -4 8 2 q5 -3 9 3z" fill="${t.acc}" opacity=".92"/><path d="M70 58 q24 -18 28 1 q-8 -3 -11 3 q-5 -4 -8 2 q-5 -3 -9 3z" fill="${t.acc}" opacity=".92"/><path d="M30 58 q-22 -15 -25 1" fill="none" stroke="${t.accD}" stroke-width="1" opacity=".5"/><path d="M70 58 q22 -15 25 1" fill="none" stroke="${t.accD}" stroke-width="1" opacity=".5"/><ellipse cx="50" cy="66" rx="20" ry="16" fill="${g.fill}"/><ellipse cx="50" cy="70" rx="11" ry="11" fill="${t.belly}"/><path d="M44 70 h12 M44 75 h12" stroke="${t.bodyD}" stroke-width="1" opacity=".4"/><circle cx="50" cy="46" r="16" fill="${g.fill}"/><path d="M40 32 l-2 -9 7 6z" fill="${t.acc}"/><path d="M60 32 l2 -9 -7 6z" fill="${t.acc}"/><path d="M44 32 l-3 -8 6 5z M56 32 l3 -8 -6 5z" fill="${t.bodyL}"/>${eyes(t,43,57,45,0.85)}<ellipse cx="50" cy="52" rx="6" ry="4" fill="${t.bodyD}"/><circle cx="47" cy="52" r="1" fill="#2c2622"/><circle cx="53" cy="52" r="1" fill="#2c2622"/>${blush(t,38,62,52)}`,50,22];},
    fawn(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,20)}<ellipse cx="50" cy="68" rx="17" ry="15" fill="${g.fill}"/><circle cx="42" cy="74" r="2" fill="${t.belly}"/><circle cx="56" cy="76" r="2" fill="${t.belly}"/><circle cx="50" cy="48" r="15" fill="${g.fill}"/><ellipse cx="36" cy="40" rx="5" ry="9" fill="${g.fill}" transform="rotate(-25 36 40)"/><ellipse cx="64" cy="40" rx="5" ry="9" fill="${g.fill}" transform="rotate(25 64 40)"/><path d="M40 32 v-8 M44 30 v-6" stroke="${t.bodyD}" stroke-width="2" stroke-linecap="round"/><path d="M60 32 v-8 M56 30 v-6" stroke="${t.bodyD}" stroke-width="2" stroke-linecap="round"/>${eyes(t,43,57,48,0.82)}<ellipse cx="50" cy="54" rx="3" ry="2.2" fill="#2c2622"/>${blush(t,38,62,53)}`,50,18];},
    raccoon(t){return [`${shadow(50,88,22)}<ellipse cx="50" cy="68" rx="19" ry="15" fill="hsl(${t.hue},14%,58%)"/><circle cx="50" cy="48" r="17" fill="hsl(${t.hue},14%,64%)"/><path d="M34 36 l-3 -11 11 6z" fill="hsl(${t.hue},14%,52%)"/><path d="M66 36 l3 -11 -11 6z" fill="hsl(${t.hue},14%,52%)"/><path d="M30 48 q12 10 20 0 q-8 -6 -20 0z" fill="#2c2622" opacity=".75"/><path d="M70 48 q-12 10 -20 0 q8 -6 20 0z" fill="#2c2622" opacity=".75"/><circle cx="50" cy="40" r="5" fill="#fff" opacity=".5"/><circle cx="42" cy="48" r="3" fill="#fff"/><circle cx="58" cy="48" r="3" fill="#fff"/><circle cx="42" cy="48" r="2" fill="#2c2622"/><circle cx="58" cy="48" r="2" fill="#2c2622"/><circle cx="50" cy="55" r="2.4" fill="#2c2622"/>${smile(50,59,3.5)}${blush(t,36,64,55)}`,50,22];},
    mouse(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,88,18)}<path d="M62 70 q16 4 16 -6 q-2 -6 -8 -4" stroke="${t.bodyD}" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="62" rx="17" ry="15" fill="${g.fill}"/><circle cx="36" cy="42" r="9" fill="${g.fill}"/><circle cx="64" cy="42" r="9" fill="${g.fill}"/><circle cx="36" cy="42" r="5" fill="hsl(${t.hue},75%,84%)"/><circle cx="64" cy="42" r="5" fill="hsl(${t.hue},75%,84%)"/>${eyes(t,43,57,56,0.8)}<circle cx="50" cy="62" r="2.2" fill="hsl(330,70%,68%)"/><path d="M50 64 q-6 1 -10 -1 M50 64 q6 1 10 -1" stroke="#2c2622" stroke-width="0.7" fill="none" opacity=".5"/>${blush(t,38,62,62)}`,50,28];},
    lizard(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,86,24)}<path d="M70 60 q18 -4 22 4 q-8 8 -18 2z" fill="${t.bodyD}"/><ellipse cx="48" cy="62" rx="24" ry="12" fill="${g.fill}"/><path d="M24 62 q-7 5 -11 3 M30 70 q-3 7 -8 7 M66 70 q3 7 8 7" stroke="${g.fill}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M28 54 q18 -7 38 0" stroke="${t.acc}" stroke-width="2.5" fill="none" opacity=".5"/>${mark(t,46,62,0.8)}<circle cx="26" cy="55" r="6" fill="${g.fill}"/><circle cx="24" cy="54" r="2.6" fill="#2c2622"/><circle cx="35" cy="54" r="2.6" fill="#2c2622"/><circle cx="23" cy="53" r="0.9" fill="#fff"/>${blush(t,24,38,60)}`,46,38];},
    jellyfish(t){const g=bodyGrad(t);return [`<defs>${g.def}</defs>${shadow(50,90,18)}<path d="M28 50 q0 -24 22 -24 q22 0 22 24 q-11 5 -22 0 q-11 5 -22 0z" fill="${g.fill}" opacity=".92"/><ellipse cx="42" cy="38" rx="4" ry="6" fill="#fff" opacity=".4"/>${[34,42,50,58,66].map((x,i)=>`<path d="M${x} 52 q${i%2?4:-4} 14 0 24" stroke="${t.acc}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".8"/>`).join('')}${eyes(t,44,56,42,0.8)}${smile(50,47,3.5)}${blush(t,38,62,46)}`,50,24];},
    swan(t){return [`${shadow(50,90,22)}<ellipse cx="46" cy="64" rx="24" ry="14" fill="#fff"/><ellipse cx="46" cy="64" rx="24" ry="14" fill="hsl(${t.hue},30%,70%)" opacity=".18"/><path d="M64 60 q14 -2 14 -22 q0 -10 -6 -10 q-5 0 -5 8 q0 14 -8 18z" fill="#fff" stroke="hsl(${t.hue},20%,82%)" stroke-width="0.6"/><path d="M66 30 l-9 2 8 4z" fill="hsl(20,85%,58%)"/><circle cx="68" cy="32" r="2.6" fill="#2c2622"/><path d="M28 60 q-8 6 -14 4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>${blush(t,60,72,36)}`,50,16];}
  };

  /* ---- NEW species as data rows (composed). Appended AFTER the 40 bespoke ones,
     so KEYS order is preserved and existing renders never change. Scale freely:
     each new critter is just one line. ---- */
  const SPECIES2={
    pup:{shape:'std',ears:'floppy',tail:'fluffy',nose:'snout',belly:true},
    kitten:{shape:'std',ears:'pointy',tail:'thin',nose:'dot'},
    cub:{shape:'round',ears:'round',nose:'dot',belly:true},
    wolfie:{shape:'std',ears:'pointy',tail:'fluffy',nose:'snout'},
    ferret:{shape:'std',ears:'round',tail:'thin',nose:'dot',belly:true},
    squirrel:{shape:'std',ears:'tuft',tail:'fluffy',nose:'dot'},
    corgi:{shape:'std',ears:'pointy',tail:'puff',nose:'snout',belly:true},
    husky:{shape:'std',ears:'pointy',tail:'curl',nose:'snout'},
    lynx:{shape:'round',ears:'tuft',tail:'puff',nose:'dot'},
    deerling:{shape:'std',ears:'long',tail:'puff',nose:'dot',eyeSz:0.9},
    joey:{shape:'tall',ears:'round',tail:'thin',nose:'dot',belly:true},
    lamb:{shape:'round',ears:'floppy',tail:'puff',nose:'button',belly:true},
    piglet:{shape:'round',ears:'pointy',tail:'curl',nose:'snout',belly:true},
    calf:{shape:'std',ears:'floppy',tail:'thin',nose:'snout',belly:true},
    pony:{shape:'std',ears:'pointy',tail:'fluffy',nose:'snout'},
    kidgoat:{shape:'std',ears:'horn',tail:'thin',nose:'dot'},
    puffball:{shape:'round',ears:'none',tail:'none',nose:'dot'},
    fuzzling:{shape:'round',ears:'tuft',tail:'none',nose:'button',belly:true},
    mossling:{shape:'round',ears:'horn',tail:'none',nose:'dot'},
    pebbling:{shape:'wide',ears:'none',tail:'none',nose:'dot'},
    chinchi:{shape:'round',ears:'round',tail:'fluffy',nose:'button',belly:true},
    batling:{shape:'round',ears:'pointy',tail:'none',nose:'button'},
    sproutkin:{shape:'tall',ears:'horn',tail:'none',nose:'dot',belly:true},
    totem:{shape:'tall',ears:'tuft',tail:'none',nose:'dot'},
    owlet:{shape:'tall',ears:'tuft',tail:'none',nose:'beak',eyeSz:1},
    birdie:{shape:'round',ears:'none',tail:'fin',nose:'beak'},
    robin:{shape:'std',ears:'none',tail:'thin',nose:'beak',belly:true},
    chickling:{shape:'round',ears:'none',tail:'puff',nose:'beak'},
    finling:{shape:'wide',ears:'fin',tail:'fin',nose:'none',eyeSz:0.8},
    guppy:{shape:'wide',ears:'fin',tail:'fin',nose:'none'},
    splash:{shape:'round',ears:'fin',tail:'fin',nose:'dot'},
    tortie:{shape:'wide',ears:'none',tail:'none',nose:'dot',belly:true},
    gecko2:{shape:'wide',ears:'none',tail:'curl',nose:'dot'},
    moleling:{shape:'round',ears:'none',tail:'thin',nose:'snout'},
    possum:{shape:'std',ears:'round',tail:'thin',nose:'snout'},
    sugarglide:{shape:'round',ears:'round',tail:'fluffy',nose:'button',belly:true}
  };
  Object.keys(SPECIES2).forEach(k=>{ const sp=SPECIES2[k]; ARCH[k]=(t)=>compose(t,sp); });

  const NAMES={
    koi:'Koi', axolotl:'Axolotl', hummingbird:'Hummingbird', dragonfly:'Dragonfly',
    octopus:'Octopus', seahorse:'Seahorse', starfish:'Starfish', jellyfish:'Jellyfish',
    kidgoat:'Kid Goat', gecko2:'Gecko', tortie:'Tortoise', sugarglide:'Sugar Glider',
    fuzzling:'Fuzzling', mossling:'Mossling', pebbling:'Pebbling', sproutkin:'Sproutkin'
  };

  const KEYS=Object.keys(ARCH);
  // FROZEN denominator for the render fallback (an invalid/missing stored archetype).
  // Adding species grows KEYS, which would otherwise re-map every legacy seed that
  // hits the fallback → silently re-skinning old critters. Pinning to the original
  // species count keeps that path stable forever. (New mints use archetypeFor with
  // the full list and STORE the result, so they never depend on this.)
  const FALLBACK_N=40;

  function sparkles(t,n,rfn){let r=rfn||t.r,out='';for(let i=0;i<n;i++){const a=r()*Math.PI*2,rad=38+r()*8,x=f1(50+rad*Math.cos(a)),y=f1(54+rad*Math.sin(a)),sz=f1(2+r()*2);out+=star(x,y,sz,'hsl(50,100%,75%)');}return out;}
  // showcase-only scene behind the critter (a rounded card) — opt-in via render opts.bg
  function background(t){const c=t.uid,b=t.bg;
    if(b==='sky')return `<defs><radialGradient id="bg${c}" cx="50%" cy="36%" r="78%"><stop offset="0%" stop-color="#46589a"/><stop offset="100%" stop-color="#1b2350"/></radialGradient></defs><rect width="100" height="100" rx="22" fill="url(#bg${c})"/><circle cx="24" cy="22" r="1.2" fill="#fff" opacity=".9"/><circle cx="73" cy="17" r="1.5" fill="#fff" opacity=".9"/><circle cx="85" cy="38" r="1" fill="#fff" opacity=".8"/><circle cx="35" cy="33" r="0.9" fill="#fff" opacity=".7"/><circle cx="62" cy="44" r="0.8" fill="#fff" opacity=".6"/>`;
    if(b==='meadow')return `<defs><linearGradient id="bg${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#bfe8ff"/><stop offset="58%" stop-color="#d4f0fb"/><stop offset="100%" stop-color="#8ed179"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#bg${c})"/>`;
    if(b==='sunset')return `<defs><linearGradient id="bg${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd089"/><stop offset="55%" stop-color="#ff9d7a"/><stop offset="100%" stop-color="#c86fa6"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#bg${c})"/>`;
    if(b==='bubbles')return `<defs><radialGradient id="bg${c}" cx="50%" cy="40%" r="78%"><stop offset="0%" stop-color="#d9f4ef"/><stop offset="100%" stop-color="#a3dde6"/></radialGradient></defs><rect width="100" height="100" rx="22" fill="url(#bg${c})"/><circle cx="20" cy="30" r="5" fill="#fff" opacity=".25"/><circle cx="81" cy="24" r="7" fill="#fff" opacity=".22"/><circle cx="72" cy="63" r="4" fill="#fff" opacity=".25"/><circle cx="27" cy="71" r="6" fill="#fff" opacity=".2"/>`;
    return '';}

  /* ============================================================
     TIER PRESTIGE VISUALS — a critter visibly GROWS GRANDER as it climbs
     the combine ladder. tier<=0 adds NOTHING (byte-identical to legacy →
     golden-safe). Higher tiers unlock CUMULATIVE flourishes (glow → gem →
     wings → halo → flames → crown+star-ring → prismatic → cosmic), drawn
     from a DEDICATED rng so the body/sparkle streams are untouched. The
     8 prestige stages spread across the long ladder, so each climb is a
     visible glow-up — fusing high critters feels genuinely special.
     ============================================================ */
  function tierStage(tier){ tier=tier|0;
    if(tier<=0)return 0; if(tier<4)return 1; if(tier<7)return 2; if(tier<11)return 3;
    if(tier<15)return 4; if(tier<20)return 5; if(tier<25)return 6; if(tier<31)return 7; return 8; }
  const TIER_HUE=[0,48,150,188,270,330,45,300,250];   // glow hue per prestige stage
  function tWings(id,hue,stage){const s=f1(0.92+stage*0.05);
    return `<defs><linearGradient id="w${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},92%,84%)"/><stop offset="100%" stop-color="hsl(${hue},86%,60%)"/></linearGradient></defs>`+
      `<g transform="translate(50 60) scale(${s})" opacity=".82"><path d="M0 0 q-26 -19 -34 1 q-4 17 12 19 q15 1 22 -11z" fill="url(#w${id})"/><path d="M0 0 q26 -19 34 1 q4 17 -12 19 q-15 1 -22 -11z" fill="url(#w${id})"/><path d="M-2 1 q-16 -10 -26 2 M2 1 q16 -10 26 2" stroke="hsl(${hue},85%,96%)" stroke-width="1" fill="none" opacity=".55"/></g>`;}
  function tGem(id,hue){return `<g transform="translate(50 64)"><path d="M0 -5 l4.5 3.5 -4.5 8 -4.5 -8z" fill="hsl(${hue},96%,66%)" stroke="#fff" stroke-width="0.8"/><path d="M0 -5 l4.5 3.5 -2.2 0z" fill="#fff" opacity=".65"/></g>`;}
  function tHalo(hue,ax,ay){const y=f1(ay-5);return `<ellipse cx="${ax}" cy="${y}" rx="13" ry="4.3" fill="none" stroke="hsl(${hue},96%,72%)" stroke-width="2.6" opacity=".92"/><ellipse cx="${ax}" cy="${y}" rx="13" ry="4.3" fill="none" stroke="#fff" stroke-width="0.8" opacity=".75"/>`;}
  function tCrown(x,y,hue){return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-12 4 l0 -11 5 5 7 -12 7 12 5 -5 0 11z" fill="#FFD64B" stroke="#E0A100" stroke-width="1"/><circle cx="-7" cy="-3" r="1.7" fill="hsl(${hue},92%,64%)"/><circle cx="0" cy="-6" r="2" fill="#ff5d8f"/><circle cx="7" cy="-3" r="1.7" fill="hsl(${(hue+60)%360},92%,64%)"/></g>`;}
  // assemble the full prestige overlay; returns {back,wings,front,spark} fragments
  function tierFx(seed,t,tier,ax,ay){
    const stage=tierStage(tier); if(!stage)return {back:'',wings:'',front:'',spark:''};
    const rt=rng(seed+'~tier'); const id=t.uid, hue=TIER_HUE[stage]; let back='',wings='',front='',spark='';
    // stage7+: cosmic ray backdrop (drawn behind everything)
    if(stage>=7){let rays='';for(let i=0;i<12;i++){const a=i*30+rt()*8;rays+=`<path d="M50 56 L${f1(50+53*Math.cos(a*Math.PI/180))} ${f1(56+53*Math.sin(a*Math.PI/180))}" stroke="hsl(${(hue+i*10)%360},92%,70%)" stroke-width="${i%2?1.4:2.6}" opacity="${i%2?'.16':'.26'}"/>`;}back+=`<g>${rays}</g>`;}
    // stage1+: themed prestige glow halo behind the critter
    back+=`<defs><radialGradient id="tg${id}"><stop offset="46%" stop-color="hsl(${hue},92%,64%,0)"/><stop offset="100%" stop-color="hsl(${hue},94%,58%,${(0.2+stage*0.03).toFixed(2)})"/></radialGradient></defs><circle cx="50" cy="56" r="49" fill="url(#tg${id})"/>`;
    // stage5+: energy plumes behind the body
    if(stage>=5)back+=`<g opacity=".6">`+[-1,1].map(s=>`<path d="M50 72 q${s*22} 4 ${s*15} -24 q${s*-3} 15 ${s*-9} 20z" fill="hsl(${(hue+28)%360},94%,62%)"/>`).join('')+`</g>`;
    // stage3+: wings behind the critter
    if(stage>=3)wings=tWings(id,hue,stage);
    // stage2+: chest gem
    if(stage>=2)front+=tGem(id,hue);
    // stage1+: orbiting motes (count grows with stage)
    {const n=Math.min(11,2+stage);for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+rt()*0.6,rad=40+rt()*7,x=f1(50+rad*Math.cos(a)),y=f1(56+rad*Math.sin(a)),rr=f1(1+rt()*1.6);front+=`<circle cx="${x}" cy="${y}" r="${rr}" fill="hsl(${(hue+i*22)%360},96%,72%)" opacity=".9"/>`;}}
    // stage4+: halo above the head
    if(stage>=4)front+=tHalo(hue,ax,ay);
    // stage6+: orbiting star ring + a prestige crown above the head
    if(stage>=6){let sr='';const n=stage>=8?8:6;for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;sr+=star(f1(50+46*Math.cos(a)),f1(56+46*Math.sin(a)),2.4,`hsl(${(hue+i*30)%360},96%,72%)`);}front+=`<g opacity=".95">${sr}</g>`+tCrown(ax,ay-13,hue);}
    // stage7+: prismatic shimmer ring on top
    if(stage>=7)front+=`<defs><linearGradient id="pr${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff8ad8" stop-opacity=".55"/><stop offset="50%" stop-color="#8ad0ff" stop-opacity=".25"/><stop offset="100%" stop-color="#9affc8" stop-opacity=".55"/></linearGradient></defs><circle cx="50" cy="56" r="47" fill="none" stroke="url(#pr${id})" stroke-width="3.5"/>`;
    spark=sparkles(t,Math.min(11,3+stage),rt);
    return {back,wings,front,spark};
  }

  function render(seed,archetype,rarity,opts){
    rarity=(rarity>=3)?3:(rarity>=2)?2:(rarity>=1)?1:0;   // normalize to 0–3 so aura visuals & rarityName always agree (identity for valid inputs)
    if(!ARCH[archetype])archetype=KEYS[hash(seed)%Math.min(KEYS.length,FALLBACK_N)];
    const t=traits(seed,rarity,archetype);
    const out=ARCH[archetype](t), inner=out[0], ax=out[1], ay=out[2];
    const c=t.uid;
    const bg=(opts&&opts.bg)?background(t):'';   // scene only in showcase views (no pond clutter)
    let aura='', spark='';
    if(rarity===1){
      // soft radial halo (transparent core) — adds a gentle glow without the
      // "critter sitting on a coloured coin" look.
      const gid='ar'+c;
      aura=`<defs><radialGradient id="${gid}"><stop offset="58%" stop-color="hsl(${t.hue2},85%,66%,0)"/><stop offset="100%" stop-color="hsl(${t.hue2},85%,64%,.28)"/></radialGradient></defs><circle cx="50" cy="56" r="48" fill="url(#${gid})"/>`;
      spark=sparkles(t,2);
    }else if(rarity===2){
      const gid='ar'+c;
      aura=`<defs><radialGradient id="${gid}"><stop offset="55%" stop-color="hsl(${t.hue2},85%,62%,0)"/><stop offset="100%" stop-color="hsl(${t.hue2},90%,60%,.4)"/></radialGradient></defs><circle cx="50" cy="56" r="48" fill="url(#${gid})"/><circle cx="50" cy="56" r="46" fill="none" stroke="hsl(${t.hue2},88%,60%,.6)" stroke-width="2" stroke-dasharray="3 5"/>`;
      spark=sparkles(t,4);
    }else if(rarity>=3){
      const gid='ar'+c;
      aura=`<defs><radialGradient id="${gid}"><stop offset="50%" stop-color="hsl(46,95%,62%,0)"/><stop offset="100%" stop-color="hsl(46,95%,58%,.5)"/></radialGradient></defs><circle cx="50" cy="56" r="49" fill="url(#${gid})"/><circle cx="50" cy="56" r="47" fill="none" stroke="hsl(45,95%,55%,.8)" stroke-width="2.5"/><circle cx="50" cy="56" r="43" fill="none" stroke="hsl(48,100%,70%,.5)" stroke-width="1"/>`;
      spark=sparkles(t,6);
    }
    if(t.shiny){   // coveted iridescent variant — rainbow rim + sparkles ON TOP of any aura, everywhere
      const sg='sh'+c;
      aura+=`<defs><linearGradient id="${sg}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff8ad8"/><stop offset="34%" stop-color="#8ad0ff"/><stop offset="67%" stop-color="#ffe98a"/><stop offset="100%" stop-color="#9affc8"/></linearGradient></defs><circle cx="50" cy="56" r="47" fill="none" stroke="url(#${sg})" stroke-width="3" opacity=".85"/>`;
      spark+=sparkles(t,5,t.r2);
    }
    // Soft white "sticker" outline around the whole critter (silhouette pops on
    // any background). Standard SVG filter — supported by every modern browser.
    const oid='o'+c;
    const outline=`<filter id="${oid}" x="-18%" y="-18%" width="136%" height="136%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="d"/><feFlood flood-color="#ffffff" result="w"/><feComposite in="w" in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    // TIER prestige overlay — empty at tier 0 (→ byte-identical legacy output).
    const tier=(opts&&opts.tier)|0, tfx=tier?tierFx(seed,t,tier,ax,ay):null;
    if(!tfx) return `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs>${outline}</defs>${bg}${aura}<g filter="url(#${oid})">${inner}${accessory(t,ax,ay)}</g>${spark}</svg>`;
    return `<svg viewBox="0 0 100 100" width="100%" height="100%"><defs>${outline}</defs>${bg}${tfx.back}${aura}${tfx.wings}<g filter="url(#${oid})">${inner}${accessory(t,ax,ay)}</g>${tfx.front}${spark}${tfx.spark}</svg>`;
  }

  return {render,list:KEYS,randomArchetype:()=>KEYS[Math.floor(Math.random()*KEYS.length)],
    name:k=>NAMES[k]||(k.charAt(0).toUpperCase()+k.slice(1)),
    rarityName:n=>['Common','Uncommon','Rare','Legendary'][n]||'Common',
    // --- deterministic helpers for combining critters ---
    archetypeFor:(seed)=>KEYS[hash(String(seed))%KEYS.length],   // a species from a seed
    combineSeed:(seeds)=>'cmb:'+hash((seeds||[]).slice().sort().join('|')).toString(36), // stable child seed
    isShiny:(seed,arch,rarity)=>traits(seed,(rarity>=3)?3:(rarity>=2)?2:(rarity>=1)?1:0,ARCH[arch]?arch:KEYS[hash(seed)%Math.min(KEYS.length,FALLBACK_N)]).shiny}; // seed-derived shiny flag
});

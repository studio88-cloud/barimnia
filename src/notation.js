/* Notazione compatta:
   corda+tasto+durata[.][segni][:grado]
   durate: w semibreve · h minima · q semiminima · e ottavo · s sedicesimo · t ottavo di terzina · u semiminima di terzina; "." = puntata
   segni: x nota morta · g ghost note · H hammer-on · P pull-off · S slide · ~ vibrato · ^ accento · T pollice · O pop · Q tapping · * armonico naturale · A armonico artificiale
   gradi: :1 :b3 :3 :5 :b7 :8 :9 …   pause: rq, re., rs …   [Sigla] all'inizio della battuta   {7/8} oppure {7/8:2+2+3} cambia il tempo */
const DUR = {w:4, h:2, q:1, e:0.5, s:0.25, t:1/3, u:2/3};
const HARM = {12:12, 7:19, 19:19, 5:24, 24:24, 4:28, 9:28, 16:28, 3:31};
function meterOf(spec){
  const m = String(spec||"4/4").match(/^(\d+)\/(\d+)(?::([\d+]+))?$/); const num = +m[1], den = +m[2];
  const groups = m[3] ? m[3].split("+").map(Number) : (den === 8 && num % 3 === 0 ? Array(num/3).fill(3) : null);
  return {num, den, len: num*4/den, groups, txt: num+"/"+den};
}
function parseBars(src, meter){
  const bars = []; const events = []; let beat = 0; let alt = 0; let pk = 0; let M = meterOf(meter);
  function mkEv(s, f, sym, dot, d, fl, deg, start, inChord){
    const ev = {s, f, sym, dot, d, deg, start, i:events.length, fl, chordTone:inChord,
      dead:fl.includes("x"), ghost:fl.includes("g"), ham:fl.includes("H"), pull:fl.includes("P"), slide:fl.includes("S"), vib:fl.includes("~"),
      acc:fl.includes("^"), thumb:fl.includes("T"), up:fl.includes("U"), pop:fl.includes("O"), tap:fl.includes("Q"), nh:fl.includes("*"), ah:fl.includes("A"), pm:fl.includes("M")};
    ev.legato = ev.ham || ev.pull || ev.slide;
    ev.midi = OPEN[ev.s] + ev.f + (ev.nh ? (HARM[ev.f]||12) - ev.f : 0) + (ev.ah ? 12 : 0);
    ev.pk = ev.legato || inChord ? "" : (pk++ % 2 ? "V" : "⊓");
    ev.dx = inChord ? "" : ev.thumb ? "T" : ev.up ? "Tu" : ev.pop ? "P" : ev.tap ? "t" : ev.legato ? "" : (alt++ % 2 ? "m" : "i");
    return ev;
  }
  src.split("|").forEach(b => {
    const bar = {chord:null, start:beat, events:[], meter:M};
    b.trim().split(/\s+/).forEach(tok => {
      if(!tok) return;
      let m;
      if((m = tok.match(/^\{(.+)\}$/))){ M = meterOf(m[1]); bar.meter = M; bar.meterChange = true; return; }
      if((m = tok.match(/^\[(.+)\]$/))){ const at = beat - bar.start; (bar.chords = bar.chords || []).push({c:m[1], at}); if(at < 1e-9) bar.chord = m[1]; return; }
      if((m = tok.match(/^r([whqestu])(\.)?$/))){ const d = DUR[m[1]] * (m[2]?1.5:1); bar.events.push({rest:true, d, start:beat, sym:m[1], dot:!!m[2]}); beat += d; return; }
      if((m = tok.match(/^\(([^)]+)\)([whqestu])(\.)?([xgHPS~^TOQ*AUM]*)$/))){
        const d = DUR[m[2]] * (m[3]?1.5:1); const parts = m[1].split("+");
        parts.forEach((pt, j) => { const q = pt.match(/^([BEADGC])(\d+)([*A]?)(?::((?:bb|b|#)?\d+))?$/); if(!q){ console.warn("Token non valido:", tok); return; }
          const fl = (m[4]||"") + q[3];
          const ev = mkEv(q[1], +q[2], m[2], !!m[3], d, fl, q[4]||"", beat, j>0); bar.events.push(ev); events.push(ev); });
        beat += d; return;
      }
      m = tok.match(/^([BEADGC])(\d+)([whqestu])(\.)?([xgHPS~^TOQ*AUM]*)(?::((?:bb|b|#)?\d+))?$/);
      if(!m){ console.warn("Token non valido:", tok); return; }
      const ev = mkEv(m[1], +m[2], m[3], !!m[4], DUR[m[3]]*(m[4]?1.5:1), m[5]||"", m[6]||"", beat, false);
      bar.events.push(ev); events.push(ev); beat += ev.d;
    });

    bar.len = M.len; bar.end = Math.max(beat, bar.start + M.len); bar.used = beat - bar.start; beat = bar.end; bars.push(bar);
  });
  return {bars, events, beats: beat};
}
function noteName(midi){ return S._letters ? EN[midi % 12] : IT[midi % 12]; }
function degNum(d){ const n = parseInt(String(d).replace(/[b#]/g,""),10); return isNaN(n) ? 0 : n; }
function degColor(d){ const n = degNum(d); return n===1||n===8 ? (n===1?"var(--deg1)":"var(--deg8)") : n===5 ? "var(--deg5)" : n===3||n===10 ? "var(--d3)" : n===7 ? "var(--d7)" : n ? "var(--d9)" : "var(--violet)"; }
function boardPositions(spec){
  if(spec === "naturali"){
    const out=[]; strings().forEach(s => { for(let f=0; f<=12; f++){ const pc=(OPEN[s]+f)%12; if([0,2,4,5,7,9,11].includes(pc)) out.push({s,f,deg:0}); } });
    return out;
  }
  return spec.split(/\s+/).map(t => { const m=t.match(/^([BEADGC])(\d+)(\*)?(?::((?:bb|b|#)?\d+))?$/); if(!m) return null; const p = {s:m[1], f:+m[2], deg:m[4]||""}; if(m[3] && HARM[p.f]){ p.nh = true; p.midi = OPEN[p.s] + HARM[p.f]; } return p; }).filter(Boolean);
}

/* Manico a pallini: corda più acuta in alto, come la tab. Per i mancini si specchia in orizzontale.
   Se le note superano il 12° tasto si mostra solo la "finestra" di tasti utile. */
function svgBoard(pos, opt){
  opt = opt || {};
  pos = pos.filter(p => !p.rest && !p.dead);
  const st = strings(); const n = st.length;
  const fr = pos.map(p => p.f); const maxF = Math.max(5, ...fr); const minFr = Math.min(...fr.filter(f => f>0).concat([99]));
  let lo = 0, hi;
  if(maxF <= 12){ hi = maxF <= 5 ? 5 : maxF <= 8 ? 9 : 12; }
  else { lo = Math.max(0, Math.min(minFr, maxF - 4) - 1); hi = Math.min(24, Math.max(maxF + 1, lo + 5)); if(hi - lo > 12) lo = hi - 12; }
  const N = hi - lo;
  const W = 352, nut = 34, fw = (W - nut - 10) / N, top = 18, gap = 22, H = top*2 + (n-1)*gap + 14;
  const X = x => S.lefty ? W - x : x;
  const fx = f => f === 0 ? 16 : nut + (f - lo - .5) * fw;
  let g = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Manico del basso a pallini">`;
  for(let k=0; k<=N; k++){ const x = nut + k*fw; const isNut = k===0 && lo===0; g += `<line x1="${X(x)}" x2="${X(x)}" y1="${top-6}" y2="${top+(n-1)*gap+6}" stroke="${isNut?'var(--text)':'var(--border)'}" stroke-width="${isNut?4:1.5}"/>`; }
  [3,5,7,9,12,15,17,19,21,24].filter(f => f>lo && f<=hi).forEach(f => {
    const cy = top + (n-1)*gap/2, x = X(nut + (f-lo-.5)*fw);
    if(f===12||f===24){ g += `<circle cx="${x}" cy="${cy-gap/2}" r="3.5" fill="var(--border)"/><circle cx="${x}" cy="${cy+gap/2}" r="3.5" fill="var(--border)"/>`; }
    else g += `<circle cx="${x}" cy="${cy}" r="3.5" fill="var(--border)"/>`;
    g += `<text x="${x}" y="${H-2}" text-anchor="middle" font-size="10" fill="var(--muted)">${f}</text>`;
  });
  st.forEach((s,i) => { const y = top + i*gap; g += `<line x1="${X(nut)}" x2="${X(W-10)}" y1="${y}" y2="${y}" stroke="var(--muted)" stroke-width="${1+i*0.35}"/><text x="${X(4)}" y="${y+4}" font-size="11" fill="var(--muted)" text-anchor="${S.lefty?'end':'start'}">${opt.letters ? s : STRNAME[s]}</text>`; });
  const seen = {};
  pos.forEach(p => {
    const k = p.s + p.f; if(seen[k]) return; seen[k] = 1;
    const i = st.indexOf(p.s); if(i < 0) return;
    if(p.f > 0 && p.f <= lo) return;
    const x = X(fx(p.f)), y = top + i*gap; const midi = p.midi || (OPEN[p.s] + p.f);
    const lab = opt.letters ? EN[midi%12] : IT[midi%12];
    const shape = (p.nh || p.ah) ? `<rect x="${x-8}" y="${y-8}" width="16" height="16" transform="rotate(45 ${x} ${y})" fill="${degColor(p.deg)}" stroke="var(--bg)" stroke-width="1.5"/>` : `<circle cx="${x}" cy="${y}" r="10" fill="${degColor(p.deg)}" stroke="var(--bg)" stroke-width="1.5"/>`;
    g += `<g class="n-dot" data-pos="${k}">${shape}<text x="${x}" y="${y+3.5}" text-anchor="middle" font-size="${lab.length>2?8:9.5}" font-weight="800" fill="${degNum(p.deg)===1?'#1B1428':'var(--text)'}">${lab}</text></g>`;
  });
  return g + "</svg>";
}
function noteSpacing(parsed){ const ds = parsed.events.map(e => e.d).concat(parsed.bars.flatMap(b => b.events.filter(e => e.rest).map(e => e.d))); const mn = Math.min(1, ...ds); return mn <= 0.25 ? 84 : mn < 0.5 ? 66 : mn < 1 ? 44 : 30; }
function svgTab(parsed, opt){
  opt = opt || {};
  const st = strings(); const n = st.length; const B = parsed.beats;
  const ppb = Math.max(noteSpacing(parsed), (346 - 30) / B); const W = 30 + B*ppb + 10;
  const chordsRow = parsed.bars.some(b => b.chords) ? 18 : 0, marks = 14;
  const top = 14 + chordsRow + marks, gap = 16, H = top + (n-1)*gap + 30;
  const x = b => 30 + b*ppb;
  let g = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tablatura">`;
  st.forEach((s,i) => { const y = top + i*gap; g += `<line x1="22" x2="${W-6}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1.2"/><text x="4" y="${y+4}" font-size="11" fill="var(--muted)">${s}</text>`; });
  parsed.bars.forEach((b,bi) => {
    const bx = x(b.start) - 6; g += `<line x1="${bx}" x2="${bx}" y1="${top}" y2="${top+(n-1)*gap}" stroke="var(--muted)" stroke-width="1.2"/>`;
    (b.chords||[]).forEach(cc => { g += `<text x="${x(b.start+cc.at)}" y="${14+chordsRow-8}" font-size="12.5" font-weight="800" fill="var(--gold)">${cc.c}</text>`; });
    if(b.meterChange || (bi===0 && b.meter.txt!=="4/4")) g += `<text x="${bx+4}" y="${top+(n-1)*gap+13}" font-size="10" font-weight="800" fill="var(--lavender)">${b.meter.txt}</text>`;
  });
  g += `<line x1="${W-6}" x2="${W-6}" y1="${top}" y2="${top+(n-1)*gap}" stroke="var(--muted)" stroke-width="2"/>`;
  let prev = null;
  parsed.events.forEach(e => {
    const i = st.indexOf(e.s); if(i<0){ prev = e; return; } const y = top + i*gap, cx = x(e.start) + 4;
    let t = e.dead ? "x" : e.nh ? `<${e.f}>` : e.ah ? `${e.f}AH` : e.ghost ? `(${e.f})` : String(e.f);
    const w = t.length*7 + 6;
    const col = e.deg ? degColor(e.deg) : 'var(--text)';
    g += `<g class="n-ev" data-i="${e.i}"><rect x="${cx-w/2}" y="${y-8}" width="${w}" height="16" rx="4" fill="var(--bg)"/><text x="${cx}" y="${y+4.5}" text-anchor="middle" font-size="13" font-weight="800" fill="${col}" ${e.ghost||e.dead?'opacity=".7"':''}>${t.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text></g>`;
    const my = 14 + chordsRow + 4;
    if(e.legato && prev){ const px = x(prev.start) + 4; const lab = e.ham ? "h" : e.pull ? "p" : (e.f >= prev.f ? "/" : "\\"); g += `<path d="M${px+4} ${my+4} Q ${(px+cx)/2} ${my-6} ${cx-4} ${my+4}" fill="none" stroke="var(--lavender)" stroke-width="1.3"/><text x="${(px+cx)/2}" y="${my+12}" text-anchor="middle" font-size="10" font-weight="800" fill="var(--lavender)">${lab}</text>`; }
    if(e.pm) g += `<text x="${cx}" y="${my+4}" text-anchor="middle" font-size="9" font-weight="800" fill="var(--muted)">pm</text>`;
    if(e.acc) g += `<text x="${cx}" y="${my+4}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--gold)">&gt;</text>`;
    if(e.vib) g += `<text x="${cx+10}" y="${my+6}" font-size="12" fill="var(--lavender)">∿</text>`;
    if(e.sym === "t") g += `<text x="${cx}" y="${top-6-(n>0?0:0)}" text-anchor="middle" font-size="9" fill="var(--muted)">3</text>`;
    const dx = opt.rh === "pick" ? e.pk : opt.rh === "down" ? (e.legato || e.chordTone ? "" : "⊓") : opt.rh === "none" ? "" : e.dx;
    if(dx) g += `<text x="${cx}" y="${H-6}" text-anchor="middle" font-size="10.5" fill="${e.thumb||e.pop||e.tap?'var(--gold)':'var(--muted)'}">${dx}</text>`;
    prev = e;
  });
  return g + "</svg>";
}
/* Pentagramma in chiave di basso: il basso si scrive un'ottava sopra il suono reale. */
function svgStaff(parsed, opt){
  opt = opt || {};
  const B = parsed.beats; const ppb = Math.max(noteSpacing(parsed) + 6, (346 - 70) / B); const W = 70 + B*ppb + 10;
  const chordsRow = parsed.bars.some(b => b.chords) ? 16 : 0;
  const LETs0 = [0,0,1,1,2,3,3,4,4,5,5,6]; const dMax = Math.max(0, ...parsed.events.map(e => { const w = e.midi + 12; return (Math.floor(w/12)-1)*7 + LETs0[w%12]; }));
  const dMin = Math.min(99, ...parsed.events.map(e => { const w = e.midi + 12; return (Math.floor(w/12)-1)*7 + LETs0[w%12]; }));
  const extra = Math.max(0, (dMax - 33) * 5), below = Math.max(0, (14 - dMin) * 5);
  const bot = 100 + chordsRow + extra, H = bot + 48 + below; const yOf = d => bot - (d - 18) * 5; const x = b => 74 + b*ppb;
  let g = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pentagramma in chiave di basso">`;
  for(let k=0; k<5; k++){ const y = bot - k*10; g += `<line x1="6" x2="${W-6}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1.2"/>`; }
  const fy = bot - 30;
  g += `<circle cx="17" cy="${fy}" r="3.6" fill="var(--text)"/><path d="M17 ${fy} C 17 ${fy-12}, 37 ${fy-14}, 37 ${fy+2} C 37 ${fy+18}, 24 ${fy+28}, 10 ${fy+33}" fill="none" stroke="var(--text)" stroke-width="2.6" stroke-linecap="round"/><circle cx="44" cy="${fy-5}" r="2" fill="var(--text)"/><circle cx="44" cy="${fy+5}" r="2" fill="var(--text)"/>`;
  const m0 = parsed.bars[0].meter;
  g += `<text x="56" y="${bot-21}" font-size="17" font-weight="800" fill="var(--text)" text-anchor="middle">${m0.num}</text><text x="56" y="${bot-1}" font-size="17" font-weight="800" fill="var(--text)" text-anchor="middle">${m0.den}</text>`;
  if(opt.swing) g += `<text x="74" y="${14+chordsRow}" font-size="11" font-style="italic" fill="var(--lavender)">swing ♪♪ = ♩ ♪ in terzina</text>`;
  parsed.bars.forEach((b,bi) => {
    if(bi>0){ const bx = x(b.start) - 8; g += `<line x1="${bx}" x2="${bx}" y1="${bot-40}" y2="${bot}" stroke="var(--muted)" stroke-width="1.2"/>`; }
    if(bi>0 && b.meterChange) g += `<text x="${x(b.start)-4}" y="${bot-46}" font-size="12" font-weight="800" fill="var(--lavender)">${b.meter.txt}</text>`;
    (b.chords||[]).forEach(cc => { g += `<text x="${x(b.start+cc.at)-4}" y="${14}" font-size="12.5" font-weight="800" fill="var(--gold)">${cc.c}</text>`; });
    b.events.filter(r => r.rest).forEach(r => {
      const cx = x(r.start) + 4, my = bot - 20; let s = "";
      if(r.sym==="w") s = `<rect x="${cx-6}" y="${bot-30}" width="12" height="5" fill="var(--text)"/>`;
      else if(r.sym==="h") s = `<rect x="${cx-6}" y="${bot-25}" width="12" height="5" fill="var(--text)"/>`;
      else if(r.sym==="q"||r.sym==="u") s = `<path d="M${cx-3} ${my-14} l6 7 l-5 5 l6 8 c-5 -2 -8 0 -4 5" fill="none" stroke="var(--text)" stroke-width="2.2" stroke-linejoin="round"/>`;
      else { const fl = r.sym==="s" ? 2 : 1; s = `<line x1="${cx+3}" x2="${cx-1}" y1="${my-8}" y2="${my+8}" stroke="var(--text)" stroke-width="1.6"/>`; for(let k=0;k<fl;k++) s += `<circle cx="${cx-3}" cy="${my-7+k*7}" r="2.4" fill="var(--text)"/><path d="M${cx-3} ${my-5+k*7} q4 1 6 -3" fill="none" stroke="var(--text)" stroke-width="1.4"/>`; }
      if(r.dot) s += `<circle cx="${cx+9}" cy="${my-5}" r="1.8" fill="var(--text)"/>`;
      g += s;
    });
  });
  g += `<line x1="${W-6}" x2="${W-6}" y1="${bot-40}" y2="${bot}" stroke="var(--muted)" stroke-width="2"/>`;
  const LETs = [0,0,1,1,2,3,3,4,4,5,5,6], SHs = [1,3,6,8,10];
  const LETf = [0,1,1,2,2,3,4,4,5,5,6,6];
  parsed.events.forEach(e => {
    const w = e.midi + 12, pc = w % 12, oct = Math.floor(w/12) - 1;
    const flat = opt.flats && SHs.includes(pc);
    const d = oct*7 + (flat ? LETf[pc] : LETs[pc]), y = yOf(d), cx = x(e.start) + 4;
    for(let k=16; k>=d; k-=2) g += `<line x1="${cx-9}" x2="${cx+9}" y1="${yOf(k)}" y2="${yOf(k)}" stroke="var(--muted)" stroke-width="1.2"/>`;
    for(let k=28; k<=d; k+=2) g += `<line x1="${cx-9}" x2="${cx+9}" y1="${yOf(k)}" y2="${yOf(k)}" stroke="var(--muted)" stroke-width="1.2"/>`;
    const base = e.d / (e.dot ? 1.5 : 1);
    const hollow = base >= 2; const up = d < 22;
    let s = `<g class="n-note" data-i="${e.i}" ${e.ghost?'opacity=".6"':''}>`;
    if(SHs.includes(pc) && !e.dead) s += `<text x="${cx-16}" y="${y+4}" font-size="13" fill="var(--text)">${flat?'♭':'♯'}</text>`;
    if(e.dead) s += `<path d="M${cx-5} ${y-5} L${cx+5} ${y+5} M${cx+5} ${y-5} L${cx-5} ${y+5}" stroke="var(--text)" stroke-width="2"/>`;
    else if(e.nh || e.ah) s += `<path d="M${cx-6} ${y} L${cx} ${y-5} L${cx+6} ${y} L${cx} ${y+5} Z" fill="none" stroke="var(--text)" stroke-width="1.6"/>`;
    else s += `<ellipse cx="${cx}" cy="${y}" rx="5.8" ry="4.2" transform="rotate(-20 ${cx} ${y})" fill="${hollow?'none':'var(--text)'}" stroke="var(--text)" stroke-width="1.6"/>`;
    if(e.ghost) s += `<text x="${cx-12}" y="${y+4}" font-size="13" fill="var(--text)">(</text><text x="${cx+8}" y="${y+4}" font-size="13" fill="var(--text)">)</text>`;
    if(e.dot) s += `<circle cx="${cx+10}" cy="${y - (d%2===0?5:0)}" r="1.8" fill="var(--text)"/>`;
    if(base < 4){
      const sx = up ? cx + 5.2 : cx - 5.2, sy = up ? y - 30 : y + 30;
      s += `<line x1="${sx}" x2="${sx}" y1="${y}" y2="${sy}" stroke="var(--text)" stroke-width="1.4"/>`;
      const flags = base <= 0.25 ? 2 : base <= 0.5 || e.sym==="t" ? 1 : 0;
      for(let k=0;k<flags;k++){ const o = k*7; s += up ? `<path d="M${sx} ${sy+o} q 9 6 6 15" fill="none" stroke="var(--text)" stroke-width="1.6"/>` : `<path d="M${sx} ${sy-o} q 9 -6 6 -15" fill="none" stroke="var(--text)" stroke-width="1.6"/>`; }
      if(e.sym==="t"||e.sym==="u") s += `<text x="${cx}" y="${up ? sy-4 : sy+12}" text-anchor="middle" font-size="9" font-style="italic" fill="var(--muted)">3</text>`;
    }
    if(e.acc) s += `<text x="${cx}" y="${up ? y+16 : y-10}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--gold)">&gt;</text>`;
    if(e.thumb||e.pop||e.tap) s += `<text x="${cx}" y="${H-6}" text-anchor="middle" font-size="10.5" fill="var(--gold)">${e.dx}</text>`;
    g += s + "</g>";
  });
  return g + "</svg>";
}

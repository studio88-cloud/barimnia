/* Sigle: fondamentale e note dell'accordo (per il pad della base sintetica e per il validatore) */
const ROOTS = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function chordInfo(sym){
  const m = String(sym).split("/")[0].match(/^([A-G])([#b♯♭]?)(.*)$/); if(!m) return null;
  const root = (ROOTS[m[1]] + (/[#♯]/.test(m[2])?1:/[b♭]/.test(m[2])?-1:0) + 12) % 12; const q = m[3];
  let iv;
  if(/^(maj7#5|Δ#5|maj7\+5)/.test(q)) iv = [0,4,8,11];
  else if(/^(maj|Δ|M7)/.test(q)) iv = [0,4,7,11];
  else if(/^(m7b5|m7♭5|ø)/.test(q)) iv = [0,3,6,10];
  else if(/^(dim7|°7|o7)/.test(q)) iv = [0,3,6,9];
  else if(/^(dim|°|o)/.test(q)) iv = [0,3,6];
  else if(/^(aug|\+)/.test(q)) iv = [0,4,8];
  else if(/^(m\(maj7\)|mMaj7|m\(Δ\)|mΔ)/.test(q)) iv = [0,3,7,11];
  else if(/^m6/.test(q)) iv = [0,3,7,9];
  else if(/^m(7|9|11|13)/.test(q)) iv = [0,3,7,10];
  else if(/^m/.test(q)) iv = [0,3,7];
  else if(/^(7sus|9sus|13sus)/.test(q)) iv = [0,5,7,10];
  else if(/^sus/.test(q)) iv = [0,5,7];
  else if(/^(7|9|11|13)/.test(q)) iv = [0,4,7,10];
  else if(/^6/.test(q)) iv = [0,4,7,9];
  else if(/^5/.test(q)) iv = [0,7];
  else iv = [0,4,7];
  return {root, iv};
}
function chordNotes(sym){
  const c = chordInfo(sym); if(!c) return [];
  const r = 48 + c.root; const base = r >= 55 ? r - 12 : r;
  return c.iv.map(i => base + 12 + i).concat(c.iv.length===2 ? [base+24] : []);
}
function pad(notes, t, dur){ notes.forEach(n => { const o = AC.createOscillator(), g = AC.createGain(); o.type="triangle"; o.frequency.value = hz(n); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(.04,t+.03); g.gain.setValueAtTime(.04,t+dur*.8); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(g).connect(AC.destination); o.start(t); o.stop(t+dur+.05); }); }
function deadNote(t){ noise(t, "bandpass", 420, .25, .05); }

/* Motore a griglia fine: 12 tick per battito (sedicesimi e terzine).
   cfg.bars = [{start, len, chord, meter}] in battiti; se manca si costruisce da cfg.chords. */
const TPB = 12;
const P = {
  on:false, timer:null, tick:0, t0:0, spb:1, cfg:null, playedSec:0, startedAt:0,
  start(cfg){
    ac(); this.stop(true); this.cfg = cfg; this.spb = 60/cfg.bpm;
    if(!cfg.bars){ const M = meterOf(cfg.meter); const ch = cfg.chords || [null,null,null,null]; cfg.bars = ch.map((c,i) => { const parts = c ? String(c).split(/\s+/) : []; return {start:i*M.len, len:M.len, chord:parts[0]||null, chords:parts.map((q,k) => ({c:q, at:k*M.len/parts.length})), meter:M}; }); cfg.beats = ch.length*M.len; }
    this.build();
    const b0 = cfg.bars[0]; this.pre = -Math.round(b0.len*TPB);
    this.tick = this.pre; this.t0 = cfg.at != null ? cfg.at : AC.currentTime + .12; this.on = true; this.startedAt = Date.now();
    this.timer = setInterval(() => this.run(), 25);
  },
  build(){
    const c = this.cfg, L = Math.round(c.beats*TPB); const A = Array.from({length:L}, () => []); let ci = 0;
    c.bars.forEach((b,bi) => {
      const s0 = Math.round(b.start*TPB), M = b.meter || meterOf("4/4"), sub = M.den === 8 ? TPB/2 : TPB, nClicks = Math.round(b.len*TPB/sub);
      let gs = [0]; if(M.groups){ gs = []; let acc = 0; M.groups.forEach(n => { gs.push(acc); acc += n; }); }
      for(let k=0;k<nClicks;k++){ const tk = s0 + k*sub; if(tk>=L) break; const strong = k===0, mid = M.groups ? gs.includes(k) : false;
        A[tk].push({a:"click", acc:strong, mid});
        A[tk].push({a:"dot", k, n:nClicks});
        if(b.chords && b.chords.length){
          if(M.den===4){ if(k===0 || (k===2 && M.num>=4)) A[tk].push({a:"kick"}); if(k%2===1) A[tk].push({a:"snare"}); }
          else { if(k===0) A[tk].push({a:"kick"}); else if(gs.includes(k)) A[tk].push({a:"snare"}); }
        }
      }
      const cl = b.chords || []; cl.forEach((cc,k) => { const tk = s0 + Math.round(cc.at*TPB); if(tk < L) A[tk].push({a:"chord", sym:cc.c, bi:ci++, dur:((k+1<cl.length ? cl[k+1].at : b.len) - cc.at)}); });
      if(cl.length){
        for(let h=0; h<b.len*2; h++){ const tk = s0 + h*TPB/2; if(tk<L) A[tk].push({a:"hat", sw: c.swing && h%2===1}); }
        if(M.den===4 && M.num>=4 && !c.swing){ const tk = s0 + Math.round(2.5*TPB); if(tk<L) A[tk].push({a:"kick"}); }
      }
    });
    (c.events||[]).forEach(e => { const tk = Math.round(e.start*TPB); if(tk < L) A[tk].push({a:"note", e, sw: c.swing && Math.round(e.start*TPB) % TPB === TPB/2}); });
    this.A = A; this.L = L;
  },
  time(tick){ return this.t0 + (tick - this.pre) * this.spb / TPB; },
  setBpm(b){ if(!this.on) return; const tNext = this.time(this.tick); this.spb = 60/b; this.t0 = tNext - (this.tick - this.pre) * this.spb / TPB; this.cfg.bpm = b; },
  run(){ while(this.time(this.tick) < AC.currentTime + .12){ this.schedule(this.tick, this.time(this.tick)); this.tick++; } },
  schedule(tick, t){
    const c = this.cfg; const delay = Math.max(0, (t - AC.currentTime) * 1000); const swT = t + this.spb/6;
    if(tick < 0){ const b0 = c.bars[0], M = b0.meter || meterOf("4/4"), sub = M.den===8 ? TPB/2 : TPB; const k = tick - this.pre; if(k % sub === 0){ const idx = k/sub; click(t, idx===0); setTimeout(() => c.onBeat && c.onBeat(idx, Math.round(b0.len*TPB/sub)), delay); } return; }
    const pos = tick % this.L;
    this.A[pos].forEach(x => {
      if(x.a==="click"){ if(c.click) click(t, x.acc, x.mid); }
      else if(x.a==="dot") setTimeout(() => c.onBeat && c.onBeat(x.k, x.n), delay);
      else if(!c.base && x.a!=="note") return;
      else if(x.a==="chord"){ pad(chordNotes(x.sym), t, x.dur*this.spb); setTimeout(() => c.onChord && c.onChord(x.bi), delay); }
      else if(x.a==="kick") kick(t);
      else if(x.a==="snare") noise(t, "bandpass", 1900, .3, .13);
      else if(x.a==="hat") noise(x.sw ? swT : t, "highpass", 7500, .055, .035);
      else if(x.a==="note"){ const e = x.e, tt = x.sw ? swT : t;
        if(c.example){ if(e.dead) deadNote(tt); else bassNote(e.midi, tt, Math.max(.06, e.d*this.spb*.92), e.ghost ? .35 : e.acc ? 1.25 : 1); }
        setTimeout(() => c.onNote && c.onNote(e), delay + (x.sw ? this.spb/6*1000 : 0)); }
    });
  },
  stop(silent){ if(this.cfg && this.cfg.onStop) this.cfg.onStop(); if(this.timer) clearInterval(this.timer); this.timer = null; if(this.on){ const sec = (Date.now() - this.startedAt)/1000; this.playedSec = sec; addPractice(sec); } this.on = false; }
};

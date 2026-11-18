const fs = require('fs'), vm = require('vm');
const d = require('path').resolve(__dirname, '..');
const ctx = {console, S:{strings:4}, Math, String, Number, Array, Object, JSON, parseInt, isNaN};
vm.createContext(ctx);
vm.runInContext(`const OPEN = {B:23, E:28, A:33, D:38, G:43, C:48}; const IT=[]; const EN=[]; const STRNAME={}; function strings(){return ["G","D","A","E"];} var CONTENT = {};`, ctx);
vm.runInContext(fs.readFileSync(d+'/src/notation.js','utf8'), ctx);
fs.readdirSync(d+'/content').filter(f=>f.endsWith('.js')).sort().forEach(f => vm.runInContext(fs.readFileSync(d+'/content/'+f,'utf8'), ctx));
const C = vm.runInContext('CONTENT', ctx);
const ORDER = [].concat(
  ["T1","T2","T3","T4","T5","P1","P2","P3","S1","S2","S3","S4","S5","T6","H1","H2","H3","H4","C1","C2","C3","T7","T8","F1","F2","T9","T10"],
  Array.from({length:15},(_,i)=>"A"+(i+1)), Array.from({length:20},(_,i)=>"L"+(i+1)));
const ireal = c => c.replace(/m\(maj7\)/g,'-^7').replace(/maj7#5/g,'^7#5').replace(/maj7#11/g,'^7#11').replace(/maj9/g,'^9').replace(/maj7/g,'^7').replace(/m\(maj7\)/g,'-^7').replace(/m7b5/g,'h7').replace(/dim7/g,'o7').replace(/dim/g,'o').replace(/m(?=\d|$|\/)/g,'-');
const map = new Map(); const rows = []; const stepMap = {};
ORDER.forEach(id => { const ch = C[id]; if(!ch) return; ch.steps.forEach((s,i) => {
  if(s.nobase) return; if(s.type === 'strumento' && !s.style) return;
  let bars, meterTxt, beats;
  if(s.type === 'crea'){ const M = ctx.meterOf(s.meter); bars = s.chords.map(c => ({ch:c, meter:M.txt, len:M.len})); }
  else if(s.bars){ const p = ctx.parseBars(s.bars, s.meter); if(!p.bars.some(b => b.chords)) return; let last = null; bars = p.bars.map(b => { const cs = (b.chords||[]).map(x=>x.c); if(cs.length) last = cs[cs.length-1]; return {ch: cs.length ? cs.join(" ") : "%", meter:b.meter.txt, len:b.len}; }); }
  else return;
  beats = bars.reduce((a,b)=>a+b.len,0);
  const bpm = s.type === 'crea' ? s.bpm : s.bpm[1];
  const style = s.style || "Pop – Rock";
  const meters = [...new Set(bars.map(b=>b.meter))];
  const key = bars.map(b=>b.ch).join("|") + "#" + meters.join(",") + "#" + style + "#" + bpm + "#" + (s.swing?1:0);
  const lab = (s.title.match(/^([A-Z]\d+)/)||[])[1] || s.type[0].toUpperCase();
  const where = `${id} ${lab}`;
  if(map.has(key)){ map.get(key).uses.push(where); stepMap[id+'-'+i] = {file:map.get(key).file, bpm}; return; }
  const giroSec = beats*60/bpm, target = s.type === 'crea' ? 180 : 120;
  const giri = Math.max(2, Math.round(target/giroSec));
  const r = {file:`${id}-${lab}_${bpm}.wav`, uses:[where], first:`${id} · ${s.title}`, style, bpm, meter:meters.join(" e "), swing:!!s.swing, nbars:bars.length,
    chart:bars.map(b=>b.ch).join(" | "), detail:bars.map(b=>({ch:b.ch,meter:b.meter})), chartIreal:bars.map(b=>b.ch==="%"?"x":b.ch.split(" ").map(ireal).join(" ")).join(" | "), giri, dur:Math.round(giri*giroSec)};
  map.set(key, r); rows.push(r); stepMap[id+'-'+i] = {file:r.file, bpm};
}); });
const mmss = s => Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
fs.mkdirSync(d+'/build',{recursive:true}); fs.writeFileSync(d+'/build/basemap.json', JSON.stringify(stepMap));
console.log(JSON.stringify(rows.map((r,k) => ({n:k+1, file:r.file, uses:r.uses.join(", "), first:r.first, style:r.style, bpm:r.bpm, meter:r.meter, swing:r.swing?"sì":"no", bars:r.nbars, chart:r.chart, ireal:r.chartIreal, giri:r.giri, dur:mmss(r.dur), detail:r.detail})), null, 1));
console.error(rows.length + " basi, " + rows.reduce((a,r)=>a+r.uses.length,0) + " passi");

// Validatore dei contenuti: battute, gradi, quiz, campi.
const fs = require('fs'), vm = require('vm');
const d = require('path').resolve(__dirname, '..');
const ctx = {console, S:{strings:4}, Math, String, Number, Array, Object, JSON, parseInt, isNaN};
vm.createContext(ctx);
vm.runInContext(`const OPEN = {B:23, E:28, A:33, D:38, G:43, C:48}; const IT=[]; const EN=[]; const STRNAME={}; function strings(){return ["G","D","A","E"];} var CONTENT = {};`, ctx);
const src = fs.readFileSync(d+'/src/notation.js','utf8');
vm.runInContext(src.replace(/console\.warn\("Token non valido:", tok\)/, 'globalThis.BAD.push(tok)'), ctx);
vm.runInContext(fs.readFileSync(d+'/src/audio.js','utf8').split('/* Motore a griglia')[0], ctx);
ctx.BAD = [];
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(d+'/content').filter(f=>f.endsWith('.js')).map(f=>d+'/content/'+f);
files.forEach(f => vm.runInContext(fs.readFileSync(f,'utf8'), ctx));
const C = vm.runInContext('CONTENT', ctx);
const IV = {'1':0,'b2':1,'2':2,'#2':3,'b3':3,'3':4,'4':5,'#4':6,'b5':6,'5':7,'#5':8,'b6':8,'6':9,'bb7':9,'b7':10,'7':11,'8':0,'b9':1,'9':2,'#9':3,'10':4,'b10':3,'11':5,'#11':6,'b13':8,'13':9,'12':7,'15':0};
let errs = 0, warns = 0; const E = (id,i,m) => { errs++; console.log(`✗ ${id} passo ${i+1}: ${m}`); }, W = (id,i,m) => { warns++; console.log(`· ${id} passo ${i+1}: ${m}`); };
const POSES = "pensierosa festa intro dorme carica triste felice neutra accorda maestra slap basso suona plettro messaggera cuffie salto conta".split(" ");
for(const id of Object.keys(C)){
  const ch = C[id]; if(!ch.steps || !ch.steps.length){ E(id,0,'nessun passo'); continue; }
  if(ch.steps[ch.steps.length-1].type !== 'quiz') E(id, ch.steps.length-1, 'manca il quiz finale');
  ch.steps.forEach((s,i) => {
    if(!s.title) E(id,i,'manca title'); if(!s.min) W(id,i,'manca min');
    if(s.type==='lezione'){ if(!s.text||!s.polly) E(id,i,'lezione senza text/polly'); else if(!POSES.includes(s.polly[0])) E(id,i,'posa sconosciuta '+s.polly[0]);
      if(s.board){ const ok = s.board==='naturali' || s.board.split(/\s+/).every(t=>/^([BEADGC])(\d+)(?::((?:bb|b|#)?\d+))?$/.test(t)); if(!ok) E(id,i,'board non valido: '+s.board); } }
    if(s.type==='app'||s.type==='quiz'){ (s.questions||[]).forEach((q,k) => { if(!(q.c>=0 && q.c<q.o.length)) E(id,i,`domanda ${k+1}: indice risposta`); if(new Set(q.o).size!==q.o.length) E(id,i,`domanda ${k+1}: opzioni duplicate`); }); if(!s.questions||!s.questions.length) E(id,i,'nessuna domanda'); if(s.type==='quiz' && s.questions.length<6) W(id,i,'quiz corto'); }
    if(['strumento','pratica','modello'].includes(s.type)){
      if(!s.bars||!s.task||!s.bpm||s.bpm.length!==2) { E(id,i,'campi mancanti'); return; }
      if(s.bpm[0]>s.bpm[1]) E(id,i,'bpm invertiti');
      ctx.BAD.length = 0; const p = ctx.parseBars(s.bars, s.meter);
      if(ctx.BAD.length) E(id,i,'token non validi: '+ctx.BAD.join(' '));
      let cur = null;
      p.bars.forEach((b,bi) => {
        if(Math.abs(b.used - b.len) > 1e-6) E(id,i,`battuta ${bi+1}: durata ${+b.used.toFixed(3)} invece di ${b.len}`);
        (b.chords||[]).forEach(cc => { if(!ctx.chordInfo(cc.c)) E(id,i,'sigla illeggibile '+cc.c); });
        b.events.filter(e=>!e.rest).forEach(e => {
          const here = (b.chords||[]).filter(cc => cc.at <= e.start - b.start + 1e-9); if(here.length){ cur = ctx.chordInfo(here[here.length-1].c); b.chord = here[here.length-1].c; }
          if(e.f>24) E(id,i,'tasto > 24');
          if(e.s==='B'||e.s==='C') E(id,i,'corda Si/Do: serve 5/6 corde');
          if(e.deg && !e.dead){ if(!(e.deg in IV)) E(id,i,'grado sconosciuto '+e.deg); else if(!cur) E(id,i,`battuta ${bi+1}: grado senza sigla`); else { const pc = ((e.midi - cur.root) % 12 + 12) % 12; if(pc !== IV[e.deg]) E(id,i,`battuta ${bi+1}: ${e.s}${e.f} non è il grado ${e.deg} di ${b.chord||'accordo precedente'}`); } }
        });
      });
    }
    if(s.type==='crea'){ if(!s.recipe||!s.checklist||!s.chords) E(id,i,'crea incompleto'); else s.chords.forEach(c => String(c).split(/\s+/).forEach(q => { if(!ctx.chordInfo(q)) E(id,i,'sigla '+q); })); }
  });
}
console.log(`\n${Object.keys(C).length} capitoli · ${errs} errori · ${warns} avvisi`);
process.exit(errs?1:0);

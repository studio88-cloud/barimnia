import numpy as np, wave, sys, json
from scipy.signal import stft
from scipy.ndimage import median_filter
NAMES="C C# D D# E F F# G G# A A# B".split()
ROOT={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def chord(c):
    r=ROOT[c[0]]+(1 if c[1:2]=='#' else -1 if c[1:2]=='b' else 0); q=c[1:] if c[1:2] not in('#','b') else c[2:]
    iv=[0,7] if q.startswith('5') else [0,3,7] if q.startswith('m') and not q.startswith('maj') else [0,4,7]
    if '7' in q and not q.startswith('5'): iv=iv+[11 if 'maj' in q else 10]
    return r%12,[(r+i)%12 for i in iv]
def check(path,bpm,giri,chords,meter_beats=4):
    w=wave.open(path); sr=w.getframerate(); n=w.getnframes(); ch=w.getnchannels(); bits=w.getsampwidth()*8
    x=np.frombuffer(w.readframes(n),dtype=np.int16).reshape(-1,ch).astype(float).mean(1)/32768
    dur=n/sr; bar=meter_beats*60/bpm; giro=len(chords)*bar
    out={'file':path.split('/')[-1],'formato':f'{sr} Hz, {bits} bit, {ch} canali','durata':round(dur,2)}
    # fine musica: ultimo punto sopra -40 dB
    hop=int(sr*.05); r=np.array([np.sqrt((x[i:i+hop]**2).mean()) for i in range(0,len(x)-hop,hop)])
    loud=np.where(20*np.log10(r+1e-9)>-40)[0]; end=(loud[-1]+1)*.05
    f,t,Z=stft(x,sr,nperseg=8192,noverlap=8192-1024); M=np.abs(Z); ht=1024/sr
    H=median_filter(M,size=(1,17)); P=median_filter(M,size=(17,1)); Hm=M*(H>P)
    def chroma(s,e,lo,hi):
        m=(f>lo)&(f<hi); pc=((np.round(12*np.log2(f[m]/440))+9)%12).astype(int); v=Hm[m][:,s:e].sum(1); c=np.zeros(12); np.add.at(c,pc,v); return c
    # trova offset (count-in) provando 0..2 battute
    best=None
    for cin in [0,1,2]:
        off=cin*bar; ok=0; tot=0
        for g in range(min(giri,4)):
            for k,c in enumerate(chords):
                s=int((off+g*giro+k*bar)/ht); e=int((off+g*giro+(k+1)*bar)/ht); cc=chroma(s,e,100,1200)
                tones=chord(c)[1]; sc=cc[tones].sum()/cc.sum(); tot+=1; ok+=sc>0.45
        if best is None or ok>best[1]: best=(cin,ok,tot)
    cin=best[0]; off=cin*bar
    out['count-in (battute)']=cin
    # accordi su tutti i giri
    good=0; tot=0; bass=0; wrong=[]
    for g in range(giri):
        for k,c in enumerate(chords):
            s=int((off+g*giro+k*bar)/ht); e=int((off+g*giro+(k+1)*bar)/ht)
            if e>M.shape[1]: continue
            cc=chroma(s,e,100,1200); tones=chord(c)[1]; sc=cc[tones].sum()/cc.sum(); tot+=1
            if sc>0.45: good+=1
            elif len(wrong)<4: wrong.append(f'giro {g+1} batt. {k+1} ({c}): {[NAMES[i] for i in np.argsort(cc)[::-1][:3]]}')
            lo=chroma(s,e,30,100); bass+= int(np.argmax(lo))==chord(c)[0]
    out['accordi giusti']=f'{good}/{tot}'; out['dubbi']=wrong
    out['basso udibile (battute con fondamentale al grave)']=f'{bass}/{tot}'
    musica_fine=off+giri*giro
    out['musica attesa fino a']=round(musica_fine,2); out['suono fino a']=round(end,2); out['coda dopo i giri']=round(end-musica_fine,2)
    # tempo dal count-in/onset
    fl=np.maximum(0,np.diff(M,axis=1)).sum(0); fl=(fl-fl.mean())/fl.std(); ac=np.correlate(fl,fl,'full')[len(fl)-1:]
    lags=np.arange(len(ac))*ht; sel=(lags>60/bpm*0.8)&(lags<60/bpm*1.25); bp=lags[sel][np.argmax(ac[sel])]
    out['tempo stimato']=round(60/bp,1)
    return out
if __name__=='__main__':
    for a in json.loads(sys.argv[1]): print(json.dumps(check(*a),ensure_ascii=False,indent=0))

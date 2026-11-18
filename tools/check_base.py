import numpy as np, wave, sys, json, re
from scipy.signal import stft
from scipy.ndimage import median_filter
import os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from checkbase import chord
N='C C# D D# E F F# G G# A A# B'.split()
rows={r['file']:r for r in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','build','basi.json')))}
def mlen(m): a,b=m.split('/'); return int(a)*4/int(b)
for p in sys.argv[1:]:
    name=re.sub(r'^[0-9a-f]{8}-','',p.split('/')[-1]); r=rows[name]; bpm=r['bpm']
    segs=[]  # (beats, chord) half-bar splitting
    for b in r['detail']:
        L=mlen(b['meter']); cs=b['ch'].split()
        for c in cs: segs.append((L/len(cs),c))
    giro=sum(s for s,_ in segs)*60/bpm
    w=wave.open(p); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).reshape(-1,2).astype(float).mean(1)/32768
    dur=len(x)/sr; hop=int(sr*.05); rr=np.array([np.sqrt((x[i:i+hop]**2).mean()) for i in range(0,len(x)-hop,hop)]); end=(np.where(20*np.log10(rr+1e-9)>-40)[0][-1]+1)*.05
    f,t,Z=stft(x,sr,nperseg=8192,noverlap=7168); M=np.abs(Z); H=median_filter(M,size=(1,17)); P=median_filter(M,size=(17,1)); Hm=M*(H>P); ht=1024/sr
    m=(f>100)&(f<1200); pc=((np.round(12*np.log2(f[m]/440))+9)%12).astype(int)
    def score(t0,t1,c):
        s=int(t0/ht); e=int(t1/ht); v=Hm[m][:,s:e].sum(1); cc=np.zeros(12); np.add.at(cc,pc,v); return cc[chord(c)[1]].sum()/max(cc.sum(),1e-9)
    # count-in = prima battuta (in secondi) del primo metro
    cinlen=mlen(r['detail'][0]['meter'])*60/bpm
    best=None
    for cin in [0,cinlen,2*cinlen]:
        ok=0;tot=0;tt=cin
        for g in range(r['giri']):
            for L,c in segs:
                d=L*60/bpm
                if tt+d>end: break
                ok+=score(tt,tt+d,c)>0.45; tot+=1; tt+=d
        if best is None or ok/ max(tot,1)>best[1]/max(best[2],1): best=(cin,ok,tot)
    cin=best[0]; giri_est=(end-2.5-cin)/giro
    print(f"{name:18s} dur {dur:.0f}s countin {cin/cinlen if cinlen else 0:.0f} batt  accordi {best[1]}/{best[2]}  giri~{giri_est:.2f}/{r['giri']}  metro {r['meter']}")

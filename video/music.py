"""
Original 13 s amapiano-style bed + impacts for a Pulse SA video, synthesised from scratch
(no samples, nothing to license). Usage: python music.py OUT.wav SEED SEMITONES IMPACT_TIMES
e.g. python music.py out.wav 42 -2 5.4,7.33,9.27  (impacts land on each photo reveal)
"""
import sys, numpy as np, wave
OUT = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 7
SHIFT = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
IMPACTS = [float(x) for x in sys.argv[4].split(",")] if len(sys.argv) > 4 and sys.argv[4] else [5.4, 7.35, 9.3]
SR=44100; T=13.0; N=int(SR*T)
rng=np.random.default_rng(SEED)
K = 2 ** (SHIFT / 12)  # transpose the whole track per story
mix=np.zeros((N,2))
def add(sig,t0,gain=1.0,pan=0.0):
    i=int(t0*SR); j=min(N,i+len(sig))
    if i>=N: return
    s=sig[:j-i]*gain
    mix[i:j,0]+=s*(1-max(0,pan)); mix[i:j,1]+=s*(1+min(0,pan))
def env(n,a=0.002,d=0.3):
    t=np.arange(n)/SR; return np.minimum(1,t/a)*np.exp(-t/d)
BPM=113; beat=60/BPM; six=beat/4
def logdrum(f0,dur=0.42):
    n=int(dur*SR); t=np.arange(n)/SR
    f=f0*(1+0.9*np.exp(-t*28))                      # pitch drop gives the "log drum" knock
    ph=2*np.pi*np.cumsum(f)/SR
    x=np.sin(ph)+0.35*np.sin(2*ph)+0.15*np.sin(3*ph)
    x=np.tanh(2.2*x)*env(n,0.003,0.16)
    return x
def kick():
    n=int(0.35*SR); t=np.arange(n)/SR
    f=50+120*np.exp(-t*35); return np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,0.001,0.12)
def shaker():
    n=int(0.06*SR); x=rng.standard_normal(n); x=np.diff(np.concatenate([[0],x]))  # bright noise
    return x*env(n,0.004,0.018)
def clap():
    n=int(0.2*SR); x=rng.standard_normal(n)*env(n,0.001,0.05)
    for k in (0.008,0.016): x[int(k*SR):]+=rng.standard_normal(n-int(k*SR))*env(n-int(k*SR),0.001,0.04)*0.7
    return x*0.6
def pad(freqs,dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=sum(np.sin(2*np.pi*f*t+np.sin(2*np.pi*0.3*t)) for f in freqs)/len(freqs)
    a=np.minimum(1,t/0.4)*np.minimum(1,(dur-t)/0.5); return x*a
def boom():
    n=int(1.4*SR); t=np.arange(n)/SR
    sub=np.sin(2*np.pi*np.cumsum(38+70*np.exp(-t*9))/SR)*np.exp(-t*2.2)
    nz=rng.standard_normal(n)*np.exp(-t*14)*0.5
    return np.tanh(1.8*(sub+nz))
def riser(dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    # sweep a simple one-pole filter upward
    y=np.zeros(n); a0=0.02; acc=0
    for k in range(n):
        a=a0+0.5*(k/n)**2; acc+=a*(x[k]-acc); y[k]=acc
    return y*(t/dur)**2*1.6
def tick():
    n=int(0.05*SR); t=np.arange(n)/SR; return np.sin(2*np.pi*1800*t)*env(n,0.0005,0.012)

# --- arrangement ---------------------------------------------------------
start_beat=1.55   # groove drops when the map appears
# hook: word hits + riser into the drop
for k,tt in enumerate([0,0.2,0.4,0.6]): add(clap(),tt,0.55); add(kick(),tt,0.7)
add(riser(1.0),0.55,0.35)
# log drum pattern (classic amapiano syncopation), in F minor-ish
PATTERNS=[[(0,43.65),(0.75,43.65),(1.5,51.91),(2.5,58.27),(3.25,43.65),(3.5,51.91)],
          [(0,43.65),(1.0,51.91),(1.75,43.65),(2.5,58.27),(3.0,51.91),(3.75,43.65)],
          [(0,43.65),(0.5,43.65),(1.5,58.27),(2.25,51.91),(3.25,43.65),(3.75,58.27)]]
pat=[(o,f*K) for o,f in PATTERNS[SEED % len(PATTERNS)]]   # beats in a 4-beat bar
bars=int((11.3-start_beat)/(4*beat))+1
for b in range(bars):
    t0=start_beat+b*4*beat
    for off,f in pat: add(logdrum(f),t0+off*beat,0.55)
    for q in range(16):
        tt=t0+q*six
        if tt<11.3: add(shaker(),tt,0.10 if q%2 else 0.16,pan=0.3)
    for q in (0,2): add(kick(),t0+q*beat,0.55)
    for q in (1,3): add(clap(),t0+q*beat,0.25)
add(pad([174.6*K,207.7*K,261.6*K],11.3-start_beat),start_beat,0.10)
# impacts on the photo reveals + ending
for tt in IMPACTS: add(boom(),tt,0.9)
add(boom(),11.2,1.0)
for k in range(3): add(tick(),11.7+k*0.12,0.3)
add(pad([174.6*K,220*K,261.6*K],1.8),11.2,0.12)
# fade out and normalise
fade=int(0.6*SR); mix[-fade:]*=np.linspace(1,0,fade)[:,None]
mix/=np.max(np.abs(mix))/0.89
with wave.open(OUT,'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix*32767).astype('<i2').tobytes())


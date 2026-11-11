import numpy as np, torch, torch.nn as nn, torch.nn.functional as F, time, sys
torch.manual_seed(0)
import os
d=np.load(os.environ.get('TR','train.npz')); t=np.load(os.environ.get('TE','test.npz'))
Ftr=torch.from_numpy(d['F']); Htr=torch.from_numpy(d['H']); GRtr=torch.from_numpy(d['GR']); MKtr=torch.from_numpy(d['MK'])
Fte=torch.from_numpy(t['F']).float(); Hte=t['H']; GRte=t['GR']
class Kopf(nn.Module):
    def __init__(s):
        super().__init__()
        s.a=nn.Conv2d(256,128,3,padding=1); s.b=nn.Conv2d(128,64,3,padding=1); s.c=nn.Conv2d(64,3,1)
        nn.init.constant_(s.c.bias[:1],-4.0)
    def forward(s,x):
        x=F.relu(s.a(x)); x=F.relu(s.b(x)); return s.c(x)
def verlust(out,H,GR,MK):
    p=torch.sigmoid(out[:,0]).clamp(1e-4,1-1e-4)
    pos=(H>0.99).float()
    neg=(1-H)**4
    l_pos=-(torch.log(p)*(1-p)**2*pos).sum()
    l_neg=-(torch.log(1-p)*p**2*neg*(1-pos)).sum()
    n=pos.sum().clamp(min=1)
    l_gr=(F.l1_loss(out[:,1:3],GR,reduction='none').sum(1)*MK).sum()/MK.sum().clamp(min=1)
    return (l_pos+l_neg)/n+0.5*l_gr
m=Kopf(); opt=torch.optim.AdamW(m.parameters(),1e-3,weight_decay=1e-4)
N=len(Ftr); E=int(sys.argv[1]) if len(sys.argv)>1 else 14
sched=torch.optim.lr_scheduler.OneCycleLR(opt,2e-3,total_steps=E*((N+63)//64))
def auswerten(thr_list=(0.3,0.4,0.5,0.6,0.7)):
    m.eval()
    with torch.no_grad(): o=m(Fte)
    p=torch.sigmoid(o[:,0]); mp=F.max_pool2d(p[:,None],3,1,1)[:,0]
    pk=(p==mp)
    res=[]
    for thr in thr_list:
        tp=fp=fn=0
        for i in range(len(p)):
            ys,xs=np.where((pk[i]&(p[i]>thr)).numpy())
            gts=list(zip(*np.where(Hte[i]>0.99)))
            used=set()
            for y,x in zip(ys,xs):
                j=[k for k,(gy,gx) in enumerate(gts) if abs(gy-y)<=1.5 and abs(gx-x)<=1.5 and k not in used]
                if j: tp+=1; used.add(j[0])
                else: fp+=1
            fn+=len(gts)-len(used)
        res.append('thr %.1f: Treffer %d verpasst %d falsch %d'%(thr,tp,fn,fp))
    m.train(); return res
for ep in range(E):
    perm=torch.randperm(N); t0=time.time(); tot=0
    for i in range(0,N,64):
        idx=perm[i:i+64]
        x=Ftr[idx].float()
        if torch.rand(1)<0.5: x=x.flip(3); h=Htr[idx].flip(2); g=GRtr[idx].flip(3); mk=MKtr[idx].flip(2)
        else: h,g,mk=Htr[idx],GRtr[idx],MKtr[idx]
        l=verlust(m(x),h,g,mk); opt.zero_grad(); l.backward(); opt.step(); sched.step(); tot+=l.item()
    print('Runde %d Verlust %.3f (%.0fs)'%(ep+1,tot/(N/64),time.time()-t0),flush=True)
    if ep%4==3 or ep==E-1: print('  ',' | '.join(auswerten()),flush=True)
torch.save(m.state_dict(),os.environ.get('OUT','kopf.pt'))

"""Erzeugt künstliche Trainingsbilder (320x320) mit Truhen + Merkmale vom Netz."""
import cv2, numpy as np, glob, random, sys, os, math
import onnxruntime as ort
sys.path.insert(0,'/home/user/Tiefenrausch/bildsucher')
import test_suche as T
IMG='/tmp/claude-0/-home-user-Tiefenrausch/c8b3ff67-e924-516b-a105-531cb5b8015f/images/'
PROMO='/home/user/Tiefenrausch/promo/'
GROESSE=320; ZELLE=16; G=GROESSE//ZELLE

HOLD=int(os.environ.get('HOLDOUT','0'))
truhen=[cv2.imread(IMG+'%d.png'%i)[:,:,:3] for i in range(1,7)]

def hintergruende(videos, n_pro_video, rnd):
    out=[]
    for v in videos:
        cap=cv2.VideoCapture(v); n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 100
        for k in range(n_pro_video):
            cap.set(cv2.CAP_PROP_POS_FRAMES, rnd.randint(0,max(0,n-1)))
            ok,f=cap.read()
            if ok and f is not None and f.std()>10: out.append(f)
        cap.release()
    return out

def farbe(img, rnd):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV).astype(np.float32)
    if rnd.random()<0.5: hsv[:,:,0]=(hsv[:,:,0]+rnd.uniform(0,180))%180
    hsv[:,:,1]*=rnd.uniform(0.5,1.3)
    hsv[:,:,2]*=rnd.uniform(0.55,1.35)
    img=cv2.cvtColor(np.clip(hsv,0,255).astype(np.uint8),cv2.COLOR_HSV2BGR).astype(np.float32)
    c=rnd.uniform(0.7,1.3); img=(img-img.mean())*c+img.mean()+rnd.uniform(-25,25)
    return np.clip(img,0,255).astype(np.uint8)

def verzerren(img, rnd, halb=False):
    h,w=img.shape[:2]
    # teilweise abschneiden
    t=[int(rnd.uniform(0,0.12)*s) for s in (h,w,h,w)]
    if halb and rnd.random()<0.4:
        # nur eine Seite/Hälfte sichtbar: 45-75 % auf einer Seite behalten
        k=rnd.randint(0,3); t[k]=int((h if k%2==0 else w)*rnd.uniform(0.25,0.55))
    img=img[t[0]:h-t[2], t[1]:w-t[3]]
    if rnd.random()<0.5: img=img[:, ::-1]
    h,w=img.shape[:2]
    d=0.14
    src=np.float32([[0,0],[w,0],[w,h],[0,h]])
    dst=src+np.float32([[rnd.uniform(-d,d)*w,rnd.uniform(-d,d)*h] for _ in range(4)])
    M=cv2.getPerspectiveTransform(src,dst)
    R=cv2.getRotationMatrix2D((w/2,h/2),rnd.uniform(-10,10),1.0)
    M=np.vstack([R,[0,0,1]]).astype(np.float64)@M
    img=cv2.warpPerspective(img,M,(w,h),borderMode=cv2.BORDER_REFLECT)
    return np.ascontiguousarray(img)

def kleben(canvas, patch, x, y, rnd):
    h,w=patch.shape[:2]
    H,W=canvas.shape[:2]
    x0,y0=max(0,x),max(0,y); x1,y1=min(W,x+w),min(H,y+h)
    if x1<=x0 or y1<=y0: return
    p=patch[y0-y:y1-y, x0-x:x1-x].astype(np.float32)
    m=np.ones(p.shape[:2],np.float32)
    r=max(1,int(min(w,h)*rnd.uniform(0.0,0.12)))
    m=cv2.copyMakeBorder(m[r:-r or None, r:-r or None] if r*2<min(m.shape) else m,0,0,0,0,cv2.BORDER_CONSTANT)
    m=cv2.resize(m,(p.shape[1],p.shape[0]))
    if r>1: m=cv2.GaussianBlur(m,(0,0),r/2)
    m=m[:,:,None]
    canvas[y0:y1,x0:x1]=(p*m+canvas[y0:y1,x0:x1].astype(np.float32)*(1-m)).astype(np.uint8)

SCHWER=[]
def beispiel(bgs, negquellen, rnd):
    negq=negquellen
    bg=rnd.choice(bgs)
    if SCHWER and rnd.random()<0.3:   # Hintergrund mit früherem Fehlalarm
        sch=rnd.choice(SCHWER); f=GROESSE/float(min(sch.shape[:2]))*rnd.uniform(1.0,1.6)
        bg=cv2.resize(sch,(max(GROESSE,int(sch.shape[1]*f)),max(GROESSE,int(sch.shape[0]*f))))
        if rnd.random()<0.5: bg=farbe(bg,rnd)
    s=rnd.uniform(0.35,1.6) if bg.shape[0]>GROESSE*2 else 1.0
    bgr=cv2.resize(bg,(max(GROESSE,int(bg.shape[1]*s)),max(GROESSE,int(bg.shape[0]*s))))
    x,y=rnd.randint(0,bgr.shape[1]-GROESSE),rnd.randint(0,bgr.shape[0]-GROESSE)
    c=bgr[y:y+GROESSE,x:x+GROESSE].copy()
    if rnd.random()<0.3:
        for _ in range(rnd.randint(1,5)):
            w,h=rnd.randint(20,140),rnd.randint(20,140); T.kleben(c,T.symbol(rnd,w,h),rnd.randint(0,GROESSE-w),rnd.randint(0,GROESSE-h),w,h)
    boxen=[]
    # Ablenkungen (Rechtecke ohne Truhe)
    for _ in range(rnd.choice([0,0,1,1,2,3])):
        q=rnd.choice(negquellen); w=int(ZELLE*math.exp(rnd.uniform(math.log(2.5),math.log(10))))
        h=int(w*rnd.uniform(0.7,1.3)); w=min(w,q.shape[1]-1); h=min(h,q.shape[0]-1)
        qx,qy=rnd.randint(0,q.shape[1]-w),rnd.randint(0,q.shape[0]-h)
        patch=farbe(verzerren(q[qy:qy+h,qx:qx+w].copy(),rnd),rnd)
        kleben(c,patch,rnd.randint(-w//4,GROESSE-w*3//4),rnd.randint(-h//4,GROESSE-h*3//4),rnd)
    # Truhen
    for _ in range(rnd.choice([0,1,1,1,2])):
        t=verzerren(rnd.choice(truhen),rnd,halb=True)
        wz=math.exp(rnd.uniform(math.log(3.0),math.log(9.5)))
        w=int(wz*ZELLE); h=int(w*t.shape[0]/t.shape[1]*rnd.uniform(0.9,1.1))
        t=cv2.resize(t,(w,h),interpolation=cv2.INTER_AREA if w<t.shape[1] else cv2.INTER_LINEAR)
        t=farbe(t,rnd)
        if rnd.random()<0.25:   # halb aus dem Bild ragen
            x,y=rnd.randint(-w//2,GROESSE-w//2),rnd.randint(-h//2,GROESSE-h//2)
        else:
            x,y=rnd.randint(-w//5,GROESSE-w*4//5),rnd.randint(-h//5,GROESSE-h*4//5)
        if any(abs((x+w/2)-(b[0]+b[2]/2))<(w+b[2])/2*0.8 and abs((y+h/2)-(b[1]+b[3]/2))<(h+b[3])/2*0.8 for b in boxen): continue
        kleben(c,t,x,y,rnd)
        if rnd.random()<0.25:   # etwas steht davor (bis ~45 % verdeckt)
            q=rnd.choice(negq); ow,oh=int(w*rnd.uniform(0.3,0.65)),int(h*rnd.uniform(0.3,0.7))
            ow,oh=max(4,min(ow,q.shape[1]-1)),max(4,min(oh,q.shape[0]-1))
            qx,qy=rnd.randint(0,q.shape[1]-ow),rnd.randint(0,q.shape[0]-oh)
            ox=x+rnd.choice([0,w-ow,rnd.randint(0,max(0,w-ow))]); oy=y+rnd.choice([0,h-oh,rnd.randint(0,max(0,h-oh))])
            kleben(c,q[qy:qy+oh,qx:qx+ow].copy(),ox,oy,rnd)
        # Rahmen = sichtbarer Teil im Bild
        x0,y0,x1,y1=max(0,x),max(0,y),min(GROESSE,x+w),min(GROESSE,y+h)
        if (x1-x0)*(y1-y0) < 0.3*w*h or min(x1-x0,y1-y0)<ZELLE*1.5: continue
        boxen.append((x0,y0,x1-x0,y1-y0))
    # ganzes Bild
    if rnd.random()<0.3: c=cv2.GaussianBlur(c,(0,0),rnd.uniform(0.5,1.5))
    if rnd.random()<0.3:
        ok,enc=cv2.imencode('.jpg',c,[cv2.IMWRITE_JPEG_QUALITY,rnd.randint(40,90)]); c=cv2.imdecode(enc,1)
    if rnd.random()<0.2: c=np.clip(c.astype(np.int16)+np.random.default_rng(rnd.randint(0,1<<30)).integers(-12,13,c.shape),0,255).astype(np.uint8)
    return c,boxen

def ziele(boxen):
    heat=np.zeros((G,G),np.float32); gr=np.zeros((2,G,G),np.float32); mask=np.zeros((G,G),np.float32)
    yy,xx=np.mgrid[0:G,0:G]
    for (x,y,w,h) in boxen:
        cx,cy=(x+w/2)/ZELLE-0.5,(y+h/2)/ZELLE-0.5
        sig=max(0.6,w/ZELLE/6)
        heat=np.maximum(heat,np.exp(-((xx-cx)**2+(yy-cy)**2)/(2*sig*sig)))
        ix,iy=int(round(cx)),int(round(cy))
        if 0<=ix<G and 0<=iy<G: heat[iy,ix]=1.0
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                jx,jy=ix+dx,iy+dy
                if 0<=jx<G and 0<=jy<G:
                    gr[0,jy,jx]=math.log(w/ZELLE); gr[1,jy,jx]=math.log(h/ZELLE); mask[jy,jx]=1
    return heat,gr,mask

def main(teil, n, seed, ausgabe):
    global truhen
    if HOLD:
        truhen=[t for i,t in enumerate(truhen) if (i+1==HOLD)==(teil!='train')]
        print('Truhen-Bilder in', teil, len(truhen))
    rnd=random.Random(seed)
    vids=sorted(glob.glob(PROMO+'*.mp4'))
    vids=vids[:40] if teil=='train' else vids[40:]
    bgs=hintergruende(vids, 14 if teil=='train' else 20, rnd)
    bilder=[cv2.imread(p) for p in glob.glob(PROMO+'*.jpg')+glob.glob(PROMO+'*.png')]
    bgs+= [b for b in bilder if b is not None] if teil=='train' else []
    print(teil,'Hintergründe',len(bgs))
    negq=bgs[:]
    global SCHWER
    SCHWER=[]
    if teil=='train' and os.path.exists('schwer.pkl'):
        import pickle
        SCHWER=pickle.load(open('schwer.pkl','rb'))
        print('schwierige Gegenbeispiele',len(SCHWER))
    so=ort.SessionOptions(); so.log_severity_level=3
    so.add_session_config_entry("session.intra_op.allow_spinning","0")
    sess=ort.InferenceSession('/home/user/Tiefenrausch/bildsucher/form_modell.onnx',so,providers=['CPUExecutionProvider'])
    M=np.array([0.485,0.456,0.406],np.float32)*255; S=np.array([0.229,0.224,0.225],np.float32)*255
    F=np.zeros((n,256,G,G),np.float16); H=np.zeros((n,G,G),np.float32); GR=np.zeros((n,2,G,G),np.float32); MK=np.zeros((n,G,G),np.float32)
    beispiele=[]
    B=32
    for i0 in range(0,n,B):
        batch=[]
        for i in range(i0,min(n,i0+B)):
            c,boxen=beispiel(bgs,negq,rnd)
            H[i],GR[i],MK[i]=ziele(boxen); batch.append(c)
            if i<40: beispiele.append((c,boxen))
        x=np.stack([((b[:,:,::-1].astype(np.float32)-M)/S).transpose(2,0,1) for b in batch])
        f=sess.run(None,{'data':x})[0]
        f=f/(np.sqrt((f*f).sum(1,keepdims=True))+1e-6)
        F[i0:i0+len(batch)]=f.astype(np.float16)
        if i0%640==0: print(i0,flush=True)
    np.savez(ausgabe,F=F,H=H,GR=GR,MK=MK)
    # Vorschau
    tiles=[]
    for c,bx in beispiele[:16]:
        c=c.copy()
        for (x,y,w,h) in bx: cv2.rectangle(c,(x,y),(x+w,y+h),(0,255,0),2)
        tiles.append(c)
    rows=[np.hstack(tiles[i:i+4]) for i in range(0,16,4)]
    cv2.imwrite(ausgabe.replace('.npz','_vorschau.jpg'),cv2.resize(np.vstack(rows),(960,960)))

if __name__=='__main__':
    main(sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4])

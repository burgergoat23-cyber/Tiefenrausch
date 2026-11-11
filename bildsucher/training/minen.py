"""Sucht Fehlalarme des aktuellen Modells in Spielbildern ohne Truhe."""
import sys, glob, random, cv2, numpy as np, pickle
sys.path.insert(0,'/home/user/Tiefenrausch/bildsucher')
import bildsucher as B
rnd=random.Random(7)
vids=sorted(glob.glob('/home/user/Tiefenrausch/promo/*.mp4'))[:40]
ms=B.ModellSucher(B.Vorlage('T',np.zeros((8,8,3),np.uint8)))
schnipsel=[]
for p in vids:
    cap=cv2.VideoCapture(p); n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    for k in range(12):
        cap.set(cv2.CAP_PROP_POS_FRAMES,rnd.randint(0,n-1)); ok,f=cap.read()
        if not ok: continue
        for s in (1.0,0.6):
            scr=cv2.resize(f,(int(1920*s),int(1080*s)))
            ms._mini=None; ms.vorher=[]
            for a in ms.suche(scr,0.3):
                m=0.6
                x0,y0=int(max(0,a.x-a.w*m)),int(max(0,a.y-a.h*m)); x1,y1=int(min(scr.shape[1],a.x+a.w*(1+m))),int(min(scr.shape[0],a.y+a.h*(1+m)))
                if x1-x0>40 and y1-y0>40: schnipsel.append(scr[y0:y1,x0:x1].copy())
print('Fehlalarm-Stellen gesammelt:',len(schnipsel))
pickle.dump(schnipsel,open('schwer.pkl','wb'))

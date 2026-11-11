"""Baut truhe_modell.onnx = Erkennungsnetz (8-Bit) + gelernter Truhen-Kopf."""
import torch, torch.nn as nn, torch.nn.functional as F, onnx, sys, numpy as np
from onnx import compose
kopf_pt, ziel = sys.argv[1], sys.argv[2]
class Kopf(nn.Module):
    def __init__(s):
        super().__init__()
        s.a=nn.Conv2d(256,128,3,padding=1); s.b=nn.Conv2d(128,64,3,padding=1); s.c=nn.Conv2d(64,3,1)
    def forward(s,x):
        x=x/(torch.sqrt((x*x).sum(1,keepdim=True))+1e-6)
        x=F.relu(s.a(x)); x=F.relu(s.b(x)); o=s.c(x)
        return torch.cat([torch.sigmoid(o[:,:1]),o[:,1:]],1)
m=Kopf(); m.load_state_dict(torch.load(kopf_pt)); m.eval()
torch.onnx.export(m,torch.zeros(1,256,20,20),'kopf.onnx',input_names=['merkmale'],output_names=['truhe'],
                  dynamic_axes={'merkmale':{0:'N',2:'h',3:'w'},'truhe':{0:'N',2:'h',3:'w'}},opset_version=13,dynamo=False)
a=onnx.load('/home/user/Tiefenrausch/bildsucher/form_modell.onnx'); b=onnx.load('kopf.onnx')
b.ir_version=a.ir_version
out=a.graph.output[0].name
g=compose.merge_models(a,b,io_map=[(out,'merkmale')])
g.doc_string='Truhen-Erkenner fuer den Bildsucher: ResNet18 v1 (ONNX Model Zoo, Apache-2.0, 8-Bit, bis stage3) + eigener Kopf'
onnx.save(g,ziel)
import onnxruntime as ort
s=ort.InferenceSession(ziel,providers=['CPUExecutionProvider'])
print([o.name for o in s.get_outputs()], s.run(None,{'data':np.zeros((1,3,320,320),np.float32)})[0].shape)

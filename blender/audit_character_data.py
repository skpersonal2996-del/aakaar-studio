import bpy,sys,json,numpy as np
from mathutils import Vector
from pathlib import Path
r=Path(__file__).resolve().parent
name=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=str(r/f'{name}-character.blend'))
ob=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.vertices)>10000][0]
mesh=ob.data
print('OBJECT',ob.name,'matrix',list(ob.matrix_world),flush=True)
mat=mesh.materials[0]
for n in mat.node_tree.nodes:
 print('NODE',n.type,n.name, getattr(n,'image',None) and (n.image.name,list(n.image.size),n.image.colorspace_settings.name),flush=True)
tex=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name=='sRGB')
w,h=tex.size
px=np.array(tex.pixels[:]).reshape((h,w,4))
vs=np.array([tuple(ob.matrix_world@v.co) for v in mesh.vertices]);uv=np.array([l.uv[:] for l in mesh.uv_layers.active.data]);cols=px[(np.clip(uv[:,1],0,.999999)*h).astype(int),(np.clip(uv[:,0],0,.999999)*w).astype(int),:3]
vi=np.array([l.vertex_index for l in mesh.loops]);sumc=np.zeros((len(vs),3));cnt=np.zeros(len(vs));np.add.at(sumc,vi,cols);np.add.at(cnt,vi,1);vc=sumc/np.maximum(cnt[:,None],1)
skin=(vc[:,0]>.45)&(vc[:,0]>vc[:,1]*1.12)&(vc[:,1]>vc[:,2]*1.08)
for group,mask in [('skin',skin),('face',skin&(vs[:,2]>1.2)),('hair',(vs[:,2]>1.1)&(vc.max(axis=1)<.35)),('ink',(vs[:,2]>1.2)&(vc.max(axis=1)<.05))]:
 a=vs[mask];print('BOUNDS',group,len(a),a.min(axis=0).tolist(),a.max(axis=0).tolist(),flush=True)
# Front surface cross sections at x near zero reveal whether nose is geometry or normal detail.
for z in np.arange(1.24,1.51,.025):
 mask=skin&(np.abs(vs[:,0])<.012)&(np.abs(vs[:,2]-z)<.006)
 if mask.any(): print('FRONT_SECTION',round(z,3),vs[mask,1].min(),flush=True)
np.savez_compressed(r/'generated'/f'{name}-audit.npz',positions=vs,colors=vc,skin=skin)

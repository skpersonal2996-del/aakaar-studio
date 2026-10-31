"""Build Aakaar's editable studio, render its posters, and export a web scene.

Run: /Applications/Blender.app/Contents/MacOS/Blender -b -t 6 --python blender/build_studio.py
Set STUDIO_PREVIEW=1 for a smaller render, or STUDIO_SKIP_RENDER=1 to export only.
No add-ons, paid assets, network access, or external Python packages are required.
"""
import bpy, math, random, os, sys
import numpy as np
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'blender'))
from export_scene import export_web
OUT = ROOT / 'blender/generated'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(28)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def rgba(h):
    h = h.lstrip('#')
    a = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return (*[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in a],1)

def mat(name, color, rough=.6, metal=0, emission=0):
    m = bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=rgba(color)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=rgba(color)
        p.inputs['Emission Strength'].default_value=emission
    return m

def noise_surface(m, scale, strength=.1, distance=.025):
    n=m.node_tree.nodes; links=m.node_tree.links; p=n.get('Principled BSDF')
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale
    tex.inputs['Detail'].default_value=3
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength
    bump.inputs['Distance'].default_value=distance
    links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])

oak=mat('Warm oak · satin grain','#986342',.42)
walnut=mat('Walnut · oiled end grain','#4e3022',.45)
black=mat('Black powder-coated steel','#252420',.37,.45)
wall=mat('Warm charcoal plaster','#44413a',.88)
cream=mat('Linen upholstery','#c7b49a',.94);noise_surface(cream,170,.38,.018)
ivory=mat('Ivory ceramics','#e6d9bd',.37)
terra=mat('Burnt sienna upholstery','#b35d35',.96);noise_surface(terra,130,.3,.015)
cushion=mat('Rust woven cushion','#a65232',.91);noise_surface(cushion,180,.45,.017)
green=mat('Leaf · deep olive','#36503a',.5)
leaflight=mat('Leaf · fresh olive','#66764a',.51)
soil=mat('Potting soil','#28241a',1)
paper=mat('Warm paper','#e7dcc4',.85)
brass=mat('Brushed aged brass','#ad8c53',.34,.72)
light=mat('Warm opal light','#ffda91',.36,0,4)
neon=mat('Amber neon lettering','#ffe1ab',.32,0,5)
pink=mat('Rose quartz light','#f1a3c3',.2,0,2)
rugmat=mat('Handwoven wool rug','#96866d',1);noise_surface(rugmat,260,.7,.035)
glass=mat('Smoked glass','#383c35',.2,.25)
screen=mat('Laptop screen','#333d44',.36,0,.25)
blue=mat('Screen lavender','#b6afcc',.65,0,.4)
chairmat=mat('Charcoal leather','#33322d',.64);noise_surface(chairmat,180,.2,.009)

# Real image grain travels with the GLB as well as the Cycles render.
def grain(m, name, c1, c2, seed):
    rng=np.random.default_rng(seed);size=512
    y,x=np.mgrid[0:size,0:size].astype(np.float32)
    wave=np.sin(y*.48+np.sin(x*.018)*3+np.sin(x*.06)*.45)
    value=np.clip(.5+.14*wave+.1*np.sin(y*1.12+np.sin(x*.03)*4)+rng.normal(0,.024,(size,size)),0,1)
    a=np.array(rgba(c1)[:3]);b=np.array(rgba(c2)[:3])
    data=np.ones((size,size,4),dtype=np.float32)
    data[:,:,:3]=a[None,None,:]*(1-value[:,:,None])+b[None,None,:]*value[:,:,None]
    # Image buffers are linear; mark as Non-Color to preserve that interpretation.
    image=bpy.data.images.new(name,width=size,height=size)
    image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(data.ravel())
    image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG';image.save();image.pack()
    node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16
    bump.inputs['Distance'].default_value=.018
    m.node_tree.links.new(node.outputs['Color'],bump.inputs['Height'])
    m.node_tree.links.new(bump.outputs['Normal'],m.node_tree.nodes['Principled BSDF'].inputs['Normal'])
grain(oak,'oak-grain','#885a38','#b98451',21)
grain(walnut,'walnut-grain','#3d271b','#694731',43)

def finish(obj,name,material,smooth=True):
    obj.name=name
    if material: obj.data.materials.append(material)
    if smooth and obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    return obj

def box(name,loc,size,m,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return finish(o,name,m,False)

def sphere(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=1,location=loc)
    o=bpy.context.object;o.scale=scale;return finish(o,name,m)

def cylinder(name,loc,r,depth,m,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc)
    return finish(bpy.context.object,name,m)

def tube(name,points,r,m,radii=None):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=10
    c.bevel_depth=r;c.bevel_resolution=3
    sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for i,(p,co) in enumerate(zip(sp.bezier_points,points)):
        p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
        if radii:p.radius=radii[i]
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);c.materials.append(m)
    return o

def segment(name,a,b,r,m,r2=None):
    v=Vector(b)-Vector(a);o=cylinder(name,(Vector(a)+Vector(b))/2,r,v.length,m,r2)
    o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return o

def text(name,body,loc,size,m,font=None):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x='CENTER';c.align_y='CENTER'
    c.size=size;c.extrude=.003;c.bevel_depth=.0015;c.bevel_resolution=3
    if font:c.font=font
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0)
    c.materials.append(m);return o

def area(name,loc,target,power,color,size=3):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def point(name,loc,power,color,radius=.2):
    d=bpy.data.lights.new(name,'POINT');d.energy=power;d.color=color;d.shadow_soft_size=radius
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;return o

# Architecture: actual boards and rounded slats make shadows do the detailing.
box('Charcoal back wall',(0,3.5,2.55),(13,.18,5.1),wall,.01)
box('Left wall',(-6.4,.2,2.55),(.16,6.6,5.1),wall,.01)
box('Right wall',(6.4,.2,2.55),(.16,6.6,5.1),wall,.01)
box('Dark studio ceiling',(0,.2,5.1),(12.8,6.6,.12),wall,.01)
for row in range(22):
    y=-5.1+row*.4
    for col in range(6):
        x=-6.4+col*2.15+(1.075 if row%2 else 0)
        if x>6.4:continue
        o=box('Individual walnut floorboard',(x,y,-.065),(2.135,.392,.12),walnut,.009)
for i in range(40):
    x=-.25+i*.108
    box('Acoustic walnut slat',(x,3.345,2.5),(.065,.12,4.98),walnut,.016)
box('Black skirting',(0,3.34,.09),(12.8,.1,.18),black,.012)
box('Floor foundation',(0,-.6,-.17),(14,11,.12),walnut,.01)
box('Ceiling beam',(0,2.4,4.9),(12.6,.26,.28),wall,.02)
box('Left ceiling beam',(-4,-.2,4.9),(.3,5.5,.3),wall,.02)
for x in [-4.1,-2.3,0,2.5,4.6]:
    cylinder('Ceiling spotlight',(x,2.25,4.7),.085,.22,black)
    cylinder('Spotlight lens',(x,2.25,4.58),.068,.012,light)
    area('Wall washer',(x,2.22,4.52),(x,3.35,2),45,(1,.71,.4),.5)

# Curtains with real pleats rather than a printed texture.
for i in range(42):
    x=-4.9+i*.103
    sphere('Linen curtain pleat',(x,3.28,2.65),(.078,.13,2.2),cream)
segment('Curtain rail',(-5,3.12,4.78),(-.55,3.12,4.78),.025,black)

fontpath=ROOT/'blender/Comfortaa.ttf'
font=bpy.data.fonts.load(str(fontpath)) if fontpath.exists() else None
text('Aakaar neon','aakaar',(1.85,3.205,3.17),.75,neon,font)
text('Studio motto','D E S I G N  ·  D E V E L O P  ·  T O G E T H E R',(1.85,3.2,2.62),.105,neon)
area('Neon wall bounce',(1.85,3.02,3.1),(1.85,3.45,3.1),55,(1,.51,.18),2)

# Large woven rug: a solid border, fine parallel warp, and short fringe.
box('Wool rug',(0,-.5,.016),(7.2,4.0,.035),rugmat,.08)
for edge in [-1,1]:
    for i in range(120):
        x=-3.5+i*.059
        tube('Rug fringe',[(x,edge*2-.5,.03),(x+.018,edge*2.1-.5,.035)],.007,cream)
for y in [-2.36,-2.28,1.28,1.36]:box('Woven rug border',(0,y,.039),(7.02,.027,.008),walnut,.002)

# Sofa and lounge area.
box('Sofa timber base',(-3.2,1.85,.45),(3.2,1.25,.3),walnut,.1)
for x in [-4.65,-1.75]:
    for y in [1.35,2.28]:cylinder('Sofa foot',(x,y,.21),.045,.35,black)
box('Linen sofa back',(-3.2,2.32,1.12),(3.25,.34,1.08),cream,.15)
for x in [-4.65,-1.75]:box('Soft sofa arm',(x,1.82,.88),(.35,1.3,.64),cream,.14)
for x in [-4.13,-3.2,-2.27]:
    box('Loose seat cushion',(x,1.69,.72),(.91,1.0,.22),cream,.1)
    box('Plump back cushion',(x,2.08,1.2),(.88,.23,.7),cream,.11)
for x,z,ang,m in [(-4.12,1.12,-.2,cushion),(-2.23,1.14,.2,terra)]:
    o=box('Rust linen pillow',(x,1.9,z),(.56,.23,.51),m,.12);o.rotation_euler.y=ang
box('Folded knit throw',(-4.0,1.36,.87),(.65,.95,.075),terra,.025)
for i in range(12):tube('Throw rib',[(-4.29+i*.052,.88,.91),(-4.29+i*.052,1.8,.91)],.007,cushion)
cylinder('Lounge table base',(-3.2,.35,.27),.28,.5,ivory,.19)
cylinder('Travertine coffee tabletop',(-3.2,.35,.57),.69,.1,ivory)
box('Coffee table book',(-3.36,.36,.66),(.42,.3,.06),terra,.01)
box('Book pages',(-3.36,.36,.667),(.4,.29,.035),paper,.004)

# Utility: books, ceramics, leaves and softly drooping vines.
bookmats=[mat('Book cloth '+str(i),h,.82) for i,h in enumerate(['#775140','#7c7761','#b39c77','#333e39','#a16b4c','#d2bf9a','#534d4a'])]
def book(name,x,y,z,w=.08,h=.32,depth=.24,m=None):
    m=m or random.choice(bookmats)
    box(name,(x,y,z+h/2),(w,depth,h),m,.006)
    for zz in [z+.045,z+h-.045]:box('Book spine gilt',(x,y-depth/2-.003,zz),(w*.7,.007,.009),brass,.001)

def leaf(name,start,end,width,m):
    a=Vector(start);b=Vector(end);direction=b-a
    side=direction.cross(Vector((0,0,1)))
    if side.length<.01:side=Vector((1,0,0))
    side.normalize();verts=[];faces=[];steps=9
    for i in range(steps):
        t=i/(steps-1);mid=a+direction*t;mid.z+=math.sin(math.pi*t)*.13
        w=math.sin(math.pi*t)**.8*width
        for s in [-1,0,1]:
            p=mid+side*w*s;p.z-=abs(s)*w*.22;verts.append(p)
    for i in range(steps-1):
        for j in range(2):faces.append((i*3+j,i*3+j+1,(i+1)*3+j+1,(i+1)*3+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    finish(o,name,m)
    solid=o.modifiers.new('Leaf thickness','SOLIDIFY');solid.thickness=.004
    tube('Leaf central vein',[a,a+direction*.5+Vector((0,0,.13)),b],.005,leaflight,[1,.7,.1])

def plant(x,y,z,size=1,potmat=ivory,big=False):
    r=.19*size;h=.34*size
    cylinder('Hand-thrown planter',(x,y,z+h/2),r*.8,h,potmat,r)
    cylinder('Rich potting soil',(x,y,z+h*.96),r*.9,.025,soil)
    for i in range(9 if big else 6):
        ang=i*2.4; reach=(.48 if big else .32)*size
        top=z+h+(.62+(i%4)*.2)*size
        a=(x,y,z+h*.9);b=(x+math.cos(ang)*reach,y+math.sin(ang)*reach,top)
        tube('Organic plant stem',[a,((a[0]+b[0])/2,(a[1]+b[1])/2,top-.3*size),b],.012*size,green)
        end=(b[0]+math.cos(ang)*.42*size,b[1]+math.sin(ang)*.42*size,b[2]-.12*size)
        leaf('Broad botanical leaf',b,end,.15*size,leaflight if i%3==0 else green)

def mug(x,y,z,m=ivory):
    cylinder('Coffee mug',(x,y,z+.09),.085,.17,m,.09)
    cylinder('Dark coffee',(x,y,z+.179),.077,.004,walnut)
    pts=[(x+.08,y,z+.15),(x+.15,y,z+.155),(x+.16,y,z+.055),(x+.08,y,z+.04)]
    tube('Mug handle',pts,.017,m)

def shelf(x,y,width,height,levels):
    for xx in [x-width/2,x+width/2]:box('Black shelf upright',(xx,y,height/2),(.035,.43,height),black,.012)
    for j in range(levels):
        zz=.2+j*(height-.3)/(levels-1)
        box('Solid oak bookshelf',(x,y,zz),(width+.08,.48,.065),walnut,.015)
        cursor=x-width/2+.11
        for k in range(random.randint(4,9)):
            bw=random.uniform(.055,.12);bh=random.uniform(.22,.43)
            book('A well-loved book',cursor,y-.03,zz+.035,bw,bh,m=random.choice(bookmats));cursor+=bw+.018
        if j%2==0:plant(x+width*.26,y,zz+.04,.5)
        else:
            cylinder('Stoneware vase',(x+width*.28,y,zz+.16),.105,.25,terra,.065)
        if j<levels-1:box('Shelf LED',(x,y+.11,zz+.075),(width-.15,.025,.012),light,.004)
    area('Bookshelf warm spill',(x,y-.12,height-.1),(x,y-.5,1),55,(1,.66,.34),1)
# The original studio's large library runs along the left wall, facing into the room.
library_before=set(bpy.data.objects)
shelf(0,0,4.8,4.3,6)
for xx in [-.8,.8]:box('Library vertical divider',(xx,0,2.15),(.035,.43,4.3),black,.01)
for j in range(6):
    zz=.2+j*.8+.035
    for center in [-.15,1.35]:
        cursor=center-.58
        for k in range(7):
            bw=.065+random.random()*.045
            book('Library book',cursor,-.03,zz,bw,.25+random.random()*.18,m=random.choice(bookmats));cursor+=bw+.017
    if j%2==0:
        cylinder('Library ceramic',(1.85,-.04,zz+.12),.08,.22,terra,.045)
    else:
        for k in range(2):box('Library stacked book',(1.85,-.04,zz+.028+k*.045),(.32,.27,.04),bookmats[(j+k)%7],.007)
library=bpy.data.objects.new('Left-wall library',None);bpy.context.collection.objects.link(library)
for o in set(bpy.data.objects)-library_before-{library}:
    o.parent=library
library.location=(-6.08,.05,0);library.rotation_euler.z=math.pi/2
shelf(-.95,2.96,.85,2.5,4)
plant(-4.2,2.66,0,1.35,black,True)
plant(4.85,2.62,0,1.5,black,True)
plant(.08,2.8,0,1.18,black,True)

# Right-hand window and low storage add a second wall and a longer view through the room.
sky=mat('Evening window sky','#b88780',.7,0,.35)
city=mat('Distant city silhouettes','#49515e',.9)
box('Deep window recess',(6.28,.45,2.8),(.14,2.65,1.95),black,.035)
box('Dusk window',(6.19,.45,2.8),(.025,2.51,1.8),sky,.005)
for i in range(14):
    yy=-.72+i*.18;h=.2+random.random()*.73
    box('City building',(6.168,yy,1.91+h/2),(.018,.17,h),city,.003)
    if i%3==0:
        for z in [2.0,2.15]:box('Distant lit window',(6.155,yy,z),(.009,.025,.04),light,.001)
for yy in [-.83,.45,1.73]:box('Window mullion',(6.135,yy,2.8),(.06,.04,1.87),black,.008)
box('Window crossbar',(6.135,.45,2.8),(.06,2.6,.04),black,.008)
box('Window-side storage',(5.96,.45,.53),(.72,2.65,1.02),walnut,.04)
for yy in [-.38,.48,1.34]:
    box('Sideboard door',(5.58,yy,.53),(.035,.82,.9),walnut,.009)
    segment('Sideboard brass handle',(5.545,yy+.25,.62),(5.545,yy+.25,.79),.012,brass)
plant(5.88,1.25,1.06,.48)
area('Window cool fill',(6.0,.45,3),(0,0,1.4),75,(.64,.73,1),2)

# Two framed pieces, each with a quiet graphic instead of a blank wall.
box('Print frame',(-2.75,3.05,2.83),(1.05,.065,1.25),walnut,.02)
box('Print paper',(-2.75,3.005,2.83),(.96,.02,1.16),paper,.004)
for x,z in [(-2.94,3.05),(-2.58,2.65)]:
    o=cylinder('Abstract print geometry',(x,2.985,z),.24,.012,black);o.rotation_euler.x=math.pi/2
box('Small studio print',(-.68,3.1,3.15),(.68,.055,.9),paper,.01)
text('Print lettering','Good\nDesign\nBuilds\nBetter\nFutures.',(-.68,3.06,3.15),.12,black)

# Storage, table lamp, and founder ID board.
box('Low walnut credenza',(3.5,2.98,.55),(3.35,.7,1.06),walnut,.055)
for x in [2.42,3.48,4.54]:
    box('Credenza door',(x,2.61,.55),(1.015,.05,.93),walnut,.012)
    segment('Brass cabinet pull',(x+.3,2.56,.68),(x+.3,2.56,.85),.012,brass)
def lamp(x,y,z,scale=1):
    cylinder('Lamp base',(x,y,z+.04*scale),.17*scale,.08*scale,black)
    cylinder('Lamp brass stem',(x,y,z+.23*scale),.018*scale,.4*scale,brass)
    cylinder('Pleated linen lampshade',(x,y,z+.52*scale),.25*scale,.3*scale,cream,.17*scale)
    cylinder('Lamp opal diffuser',(x,y,z+.37*scale),.21*scale,.012,light)
    point('Lamp warm pool',(x,y,z+.4*scale),35*scale,(1,.61,.28),.2*scale)
lamp(4.0,2.9,1.1,.9)
lamp(5.88,-.3,1.06,.85)
for i in range(3):box('Stacked design annual',(4.65,2.85,1.12+i*.055),(.52,.34,.05),bookmats[i],.008)
box('Founder board brass frame',(5.2,3.27,2.85),(1.68,.08,1.48),brass,.035)
box('Founder pegboard',(5.2,3.21,2.85),(1.59,.025,1.39),black,.015)
for i in range(12):
    for j in range(10):
        o=cylinder('Pegboard perforation',(4.49+i*.126,3.187,2.28+j*.125),.009,.004,wall);o.rotation_euler.x=math.pi/2
for i,(name,col) in enumerate([('Shruti',blue),('Vinay',terra)]):
    xx=4.82+i*.74
    box('ID lanyard',(xx,3.15,3.08),(.025,.025,.45),col,.004)
    box('Founder card',(xx,3.12,2.67),(.47,.035,.55),paper,.02)
    text('Founder name',name,(xx,3.095,2.49),.068,black)
    photo_path=OUT/(name.lower()+'-photo.png')
    if photo_path.exists():
        photo=mat(name+' ID photo','#ffffff',.85)
        image=bpy.data.images.load(str(photo_path));image.pack()
        node=photo.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
        photo.node_tree.links.new(node.outputs['Color'],photo.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
        me=bpy.data.meshes.new(name+' photo plane')
        me.from_pydata([(xx-.15,3.085,2.62),(xx+.15,3.085,2.62),(xx+.15,3.085,2.94),(xx-.15,3.085,2.94)],[],[(0,1,2,3)])
        uv=me.uv_layers.new()
        for index,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[index].uv=co
        ob=bpy.data.objects.new(name+' ID portrait',me);bpy.context.collection.objects.link(ob);finish(ob,name+' ID portrait',photo,False)

# Worktable: beveled edge, inset steel frame and honestly scaled props.
workspace_before=set(bpy.data.objects)
box('Studio desk oak slab',(0,-.27,1.29),(4.8,1.95,.13),oak,.045)
for x in [-2.12,2.12]:
    for y in [-.98,.43]:box('Desk square steel leg',(x,y,.64),(.065,.065,1.25),black,.012)
    box('Desk steel apron',(x,-.27,1.16),(.06,1.5,.12),black,.012)
box('Desk long steel stretcher',(0,.43,.72),(4.2,.055,.075),black,.008)

def laptop(x,y,z,angle):
    before=set(bpy.data.objects)
    box('Aluminum laptop base',(0,0,z),(.63,.43,.025),glass,.015)
    box('Keyboard inset',(0,.035,z+.016),(.53,.2,.005),black,.005)
    for i in range(10):
        for j in range(4):box('Laptop key',(-.235+i*.052,-.035+j*.045,z+.021),(.041,.034,.004),wall,.003)
    box('Large trackpad',(0,-.13,z+.017),(.2,.09,.004),wall,.008)
    # Screen tilts gently away from the keyboard.
    o=box('Laptop lid',(0,.2,z+.24),(.63,.027,.46),glass,.016);o.rotation_euler.x=-.2
    o=box('Laptop display',(0,.178,z+.24),(.575,.007,.395),screen,.006);o.rotation_euler.x=-.2
    for j in range(6):box('Interface code line',(-.1,.15,z+.36-j*.045),(.25+(.06 if j%2 else 0),.007,.009),blue,.002)
    for o in set(bpy.data.objects)-before:
        v=Vector((o.location.x,o.location.y,0));v.rotate(__import__('mathutils').Euler((0,0,angle)))
        o.location.x=v.x+x;o.location.y=v.y+y;o.rotation_euler.z+=angle
laptop(-1.18,-.22,1.37,-2.0)
laptop(1.2,-.18,1.37,2.2)
plant(.05,-.25,1.36,.7)
mug(-.7,-.7,1.36);mug(1.05,-.85,1.36)
box('Studio notebook',(.56,-.83,1.38),(.43,.31,.04),terra,.012)
box('Notebook pages',(.56,-.83,1.38),(.412,.3,.025),paper,.008)
segment('Pencil',(.35,-.87,1.415),(.7,-.83,1.415),.008,brass)
box('Phone',(-.28,-.91,1.38),(.17,.31,.025),black,.015)
box('Phone glass',(-.28,-.91,1.396),(.145,.27,.003),glass,.01)
for i in range(3):
    box('Desk design book',(-.28,.35,1.385+i*.06),(.53,.38,.052),bookmats[i],.008)
    box('Desk book pages',(-.28,.35,1.385+i*.06),(.51,.365,.032),paper,.005)

# Characters use ring-built connected clothing, curved locks and separately posed hands.
skin=mat('Peach clay skin','#e4ae87',.6)
p=skin.node_tree.nodes['Principled BSDF'];p.inputs['Subsurface Weight'].default_value=.075
hair=mat('Espresso sculpted hair','#211713',.8)
hairhi=mat('Hair warm edge','#2b1d17',.78)
eyes=mat('Soft oval black eyes','#18130f',.62)
sweaterdark=mat('Vinay charcoal knit','#32312d',.91);noise_surface(sweaterdark,220,.38,.014)
sweaterlight=mat('Shruti ivory knit','#dfcdb2',.94);noise_surface(sweaterlight,220,.38,.014)
pantsdark=mat('Graphite trousers','#4b4940',.88)
pantslight=mat('Camel wide-leg trousers','#987452',.88)
sole=mat('Sneaker ivory rubber','#ddd4c0',.7)
shoe=mat('Canvas sneakers','#c9c4b7',.82);noise_surface(shoe,180,.22,.008)

def rings(name,profile,m):
    verts=[];faces=[];n=32
    for z,rx,ry,cx,cy in profile:
        for j in range(n):
            a=j*math.tau/n;verts.append((cx+math.cos(a)*rx,cy+math.sin(a)*ry,z))
    for i in range(len(profile)-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    faces.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+j for j in range(n))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,m)
    mod=o.modifiers.new('Tailored smooth silhouette','SUBSURF');mod.levels=2
    return o

def hair_lock(name,controls,width,depth,material,outward=(0,-1,0)):
    """An oval sculpted lock: broad, flowing, and tapered, rather than a round tube."""
    pts=[Vector(p) for p in controls]
    def at(t):
        q=min(t*(len(pts)-1),len(pts)-1-1e-7);i=int(q);u=q-i
        p0,p1,p2,p3=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
        return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u)
    verts=[];faces=[];steps=28;sides=12
    for i in range(steps):
        t=i/(steps-1);p=at(t)
        tangent=(at(min(1,t+.005))-at(max(0,t-.005))).normalized()
        normal=Vector(outward);normal-=tangent*normal.dot(tangent)
        if normal.length<.01:normal=Vector((1,0,0))-tangent*tangent.x
        normal.normalize();across=tangent.cross(normal).normalized()
        taper=max(.018,math.sin(math.pi*(.16+.84*t))**.6)
        for j in range(sides):
            a=j*math.tau/sides
            # A faint longitudinal sculpting crease catches the light without shiny strands.
            dent=1-.035*math.cos(a*3)
            verts.append(p+across*math.cos(a)*width*taper+normal*math.sin(a)*depth*taper*dent)
    for i in range(steps-1):
        for j in range(sides):faces.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
    faces += [tuple(reversed(range(sides))),tuple((steps-1)*sides+j for j in range(sides))]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);finish(obj,name,material)
    mod=obj.modifiers.new('Soft clay hair surface','SUBSURF');mod.levels=1
    return obj

def hair_cap(female):
    verts=[];faces=[];rows=16;n=48
    for i in range(rows):
        for j in range(n):
            a=j*math.tau/n;limit=(1.45+.4*math.sin(a)) if female else (1.54+.28*math.sin(a))
            theta=.015+(limit-.015)*i/(rows-1)
            verts.append((.27*math.sin(theta)*math.cos(a),.005+.24*math.sin(theta)*math.sin(a),2.105+.285*math.cos(theta)))
    for i in range(rows-1):
        for j in range(n):faces.append((i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j))
    mesh=bpy.data.meshes.new('Contoured hairline');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Contoured hairline',mesh);bpy.context.collection.objects.link(o);finish(o,'Contoured hairline',hair)
    mod=o.modifiers.new('Soft hairline contour','SUBSURF');mod.levels=2

def reference_hair(female):
    hair_cap(female)
    if not female:
        # Short tousled curls distributed over the crown, with an irregular front fringe.
        rng=random.Random(51)
        center=Vector((0,0,2.105))
        for i in range(23):
            a=i*2.399963;theta=math.acos(1-(i+.5)/23*.86)
            if math.sin(a)<-.2:theta=min(theta,1.22)
            p=center+Vector((.252*math.sin(theta)*math.cos(a),.225*math.sin(theta)*math.sin(a),.285*math.cos(theta)))
            normal=(p-center).normalized();tangent=Vector((-math.sin(a),math.cos(a),.12*math.sin(i))).normalized()
            if i%3==0:tangent=-tangent
            lift=.035+rng.random()*.035
            curl=tangent.cross(normal).normalized()*(.025 if i%2 else -.025)
            controls=[p-tangent*.13-normal*.014,p-tangent*.07+normal*lift-curl*.4,p+tangent*.06+normal*lift*.85+curl,p+tangent*.14-normal*.015+curl*.4]
            hair_lock('Short layered curl',controls,.055+rng.random()*.012,.029,hairhi if i%7==0 else hair,normal)
        fringes=[
            [(-.17,-.12,2.32),(-.23,-.18,2.29),(-.19,-.245,2.21),(-.14,-.245,2.16)],
            [(-.07,-.12,2.38),(-.105,-.22,2.34),(-.04,-.27,2.25),(-.08,-.258,2.18)],
            [(.04,-.12,2.37),(.10,-.21,2.34),(.055,-.273,2.25),(.015,-.255,2.18)],
            [(.15,-.10,2.32),(.23,-.18,2.29),(.20,-.246,2.23),(.16,-.244,2.16)],
        ]
        for pts in fringes:hair_lock('Loose forehead curl',pts,.049,.027,hair,(0,-1,.1))
        for side in [-1,1]:hair_lock('Short temple curl',[(side*.2,.05,2.28),(side*.275,-.015,2.22),(side*.255,-.08,2.12),(side*.235,-.055,2.06)],.038,.027,hair,(side,0,0))
    else:
        # Half-up style: a small gathered bun and full waves falling behind the shoulders.
        sphere('Long hair underlayer',(0,.16,1.9),(.24,.12,.43),hair)
        for i in range(17):
            a=i*math.pi/16;x=.245*math.cos(a);y=.035+.21*math.sin(a);phase=i*.75
            controls=[(x*.75,y,2.30),(x*1.04,y+.025,2.12),(x+math.sin(phase)*.025,y+.055,1.94),(x*1.09,y+.085,1.73),(x*.95+math.sin(phase)*.018,y+.065,1.49)]
            hair_lock('Long soft wave',controls,.061+(i%3)*.006,.037,hairhi if i%8==0 else hair,(math.cos(a),math.sin(a),0))
        sphere('Small half-up bun',(.012,.2,2.365),(.106,.095,.083),hair)
        for i in range(5):
            a=(i-2)*.35
            hair_lock('Gathered bun fold',[(-.075,.19,2.35+a*.03),(-.04,.23,2.43+a*.02),(.06,.24,2.42-a*.02),(.085,.18,2.35)],.033,.024,hair,(0,1,.5))
        for side in [-1,1]:
            for i in range(6):
                controls=[(-.018,-.10+i*.022,2.38+i*.002),(side*.115,-.19+i*.019,2.35-i*.012),(side*.232,-.13+i*.022,2.25-i*.013),(side*.22,.09+i*.013,2.26),(.025,.2,2.35)]
                hair_lock('Swept half-up section',controls,.045,.025,hairhi if i==4 else hair,(side*.35,-1,.5))
            for i in range(4):
                if side<0:
                    controls=[(.005,-.11,2.385),(-.105,-.23,2.34-i*.022),(-.225,-.25,2.22-i*.012),(-.225,-.14,2.105-i*.012)]
                else:
                    controls=[(.025,-.1,2.38),(.13,-.235,2.325-i*.021),(.23,-.225,2.22-i*.012),(.245,-.09,2.13-i*.014)]
                hair_lock('Soft side-swept fringe',controls,.034,.021,hair,(0,-1,.3))
            hair_lock('Loose face-framing wave',[(side*.13,-.17,2.3),(side*.221,-.235,2.19),(side*.23,-.19,2.06),(side*.20,-.225,1.94),(side*.23,-.17,1.84)],.027,.022,hair,(0,-1,0))

def oval_eye(name,side):
    # Follow the cheek surface so the eyes remain clean ovals without protruding or clipping.
    cx=side*.081;cz=2.055;verts=[];faces=[];n=40
    for ring in [0,.5,1]:
        for j in range(n):
            a=j*math.tau/n;x=cx+math.cos(a)*.0165*ring;z=cz+math.sin(a)*.034*ring
            zn=(z-2.075)/.26;jaw=1-.09*min(0,zn)**2
            y=-.035-.222*math.sqrt(max(.01,1-(x/(.255*jaw))**2-zn**2))-.002
            verts.append((x-cx,y,z-cz))
    for r in range(2):
        for j in range(n):faces.append((r*n+j,r*n+(j+1)%n,(r+1)*n+(j+1)%n,(r+1)*n+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=(cx,0,cz)
    finish(o,name,eyes)
    for frame,sz in [(1,1),(40,1),(43,.08),(46,1),(91,1)]:
        o.scale.z=sz;o.keyframe_insert(data_path='scale',frame=frame)
    return o

def character(name,loc,angle,female=False):
    before=set(bpy.data.objects);sweater=sweaterlight if female else sweaterdark;pants=pantslight if female else pantsdark
    # Chair: upholstered shell, visible piping, armrests, five-star base and castors.
    box(name+' chair seat',(0,.05,.93),(.71,.66,.15),chairmat,.09)
    o=box(name+' chair back',(0,.34,1.38),(.69,.14,.95),chairmat,.1);o.rotation_euler.x=-.11
    for side in [-1,1]:
        tube('Chair armrest frame',[(side*.37,.19,.95),(side*.4,-.16,1.22),(side*.4,-.32,1.22)],.025,black)
        box('Padded armrest',(side*.4,-.16,1.25),(.1,.39,.05),chairmat,.025)
    cylinder('Chair gas lift',(0,.08,.52),.045,.7,black)
    for j in range(5):
        a=j*math.tau/5;xx=math.sin(a)*.42;yy=.08+math.cos(a)*.42
        segment('Chair star leg',(0,.08,.24),(xx,yy,.18),.027,black)
        sphere('Chair castor',(xx,yy,.1),(.06,.045,.065),black)
    # Sweater, with dropped shoulders and soft asymmetry.
    torso=rings(name+' sweater',[(1.0,.2,.17,0,.0),(1.06,.255,.2,0,-.02),(1.18,.26,.21,0,-.02),(1.4,.25,.19,0,-.03),(1.64,.285,.17,0,-.01),(1.76,.24,.155,0,0),(1.81,.115,.115,0,0)],sweater)
    for frame,sz in [(1,1),(46,1.006),(91,1)]:
        torso.scale.z=sz;torso.keyframe_insert(data_path='scale',frame=frame)
    tube('Ribbed sweater hem',[(-.23,-.12,1.06),(0,-.215,1.06),(.23,-.12,1.06)],.013,sweater)
    cylinder('Short tucked neck',(0,0,1.85),.079,.16,skin)
    tube('Soft crew-neck collar',[(-.08,-.06,1.81),(0,-.105,1.8),(.08,-.06,1.81)],.018,sweater)
    # Joint-free arms follow smooth bent paths to the keyboard.
    for side in [-1,1]:
        tube(name+' sleeve',[(side*.23,0,1.67),(side*.34,-.12,1.53),(side*.33,-.34,1.36),(side*.23,-.59,1.37)],.09,sweater,[1.12,1,.86,.75])
        tube('Sweater cuff seam',[(side*.18,-.6,1.36),(side*.23,-.6,1.42),(side*.28,-.6,1.36)],.014,sweater)
        sphere(name+' hand',(side*.23,-.67,1.37),(.075,.105,.04),skin)
        for f in range(4):
            xx=side*.23+(f-1.5)*.026
            tube(name+' finger',[(xx,-.7,1.375),(xx,-.76,1.375),(xx+.007,-.79,1.355)],.013,skin,[1,.9,.72])
        sphere('Thumb',(side*.23-side*.068,-.67,1.365),(.025,.05,.025),skin)
        # Seated trousers have a broad thigh and a clear bent knee.
        tube(name+' trouser leg',[(side*.145,.02,1.03),(side*.17,-.29,.99),(side*.18,-.43,.91),(side*.19,-.45,.35)],.12 if female else .105,pants,[1.12,1.08,1.0,.94 if female else .78])
        sphere(name+' sneaker sole',(side*.19,-.57,.19),(.125,.24,.07),sole)
        sphere(name+' canvas sneaker',(side*.19,-.55,.25),(.117,.215,.09),shoe)
        for j in range(4):
            yy=-.56+j*.035
            tube('Cotton shoelace',[(side*.19-.06,yy,.307),(side*.19,yy-.01,.323),(side*.19+.06,yy,.307)],.006,ivory)
    # Head group remains editable and carries a gentle animation in the exported GLB.
    headstart=set(bpy.data.objects)
    face=sphere(name+' rounded head',(0,-.035,2.075),(.255,.222,.26),skin)
    for v in face.data.vertices:
        if v.co.z<0:v.co.x*=1-.09*v.co.z*v.co.z
    for side in [-1,1]:
        sphere('Soft ear',(side*.25,-.02,2.045),(.053,.039,.07),skin)
        oval_eye(name+' oval eye',side)
        tube('Soft eyebrow',[(side*.056,-.235,2.13),(side*.08,-.243,2.134),(side*.104,-.234,2.13)],.0035,hair)
    reference_hair(female)
    head=bpy.data.objects.new(name+'_Head',None);bpy.context.collection.objects.link(head);head.location=(0,0,2.075)
    for o in set(bpy.data.objects)-headstart-{head}:
        o.parent=head;o.location-=head.location
    root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)
    for o in set(bpy.data.objects)-before-{root}:
        if o.parent is None:o.parent=root
    root.location=loc;root.rotation_euler.z=angle
    for frame,rot in [(1,(.11,.012,-.025)),(46,(.128,-.015,.02)),(91,(.11,.012,-.025))]:
        head.rotation_euler=rot;head.keyframe_insert(data_path='rotation_euler',frame=frame)
    return root
character('Vinay',(-1.88,.05,0),.78)
character('Shruti',(1.87,.32,0),-.8,True)
for obj in set(bpy.data.objects)-workspace_before:
    if obj.parent is None:obj.location.y-=.7

# Pendant lights at staggered heights, with warm pools on the work surface.
for x,z in [(-1.1,3.7),(.0,3.5),(1.05,3.35)]:
    cylinder('Pendant braided cord',(x,-.85,(4.85+z)/2),.009,4.85-z,black)
    cylinder('Pendant brass cap',(x,-.85,z+.18),.045,.09,brass)
    cylinder('Pendant black shade',(x,-.85,z),.205,.3,black,.15)
    cylinder('Pendant warm diffuser',(x,-.85,z-.155),.18,.012,light)
    area('Pendant work light',(x,-.85,z-.18),(x,-.85,1),75,(1,.73,.43),.38)

# An arched floor lamp gives the lounge its own pool of light.
cylinder('Floor lamp base',(-1.75,2.3,.07),.22,.12,black)
tube('Floor lamp arch',[(-1.75,2.3,.12),(-1.75,2.3,2.7),(-2.0,2.3,2.86),(-2.35,2.3,2.65)],.025,black)
cylinder('Floor lamp shade',(-2.35,2.3,2.57),.27,.23,cream,.16)
cylinder('Floor lamp diffuser',(-2.35,2.3,2.45),.23,.012,light)
point('Lounge lamp glow',(-2.35,2.3,2.4),65,(1,.68,.36),.25)

# Foreground foliage gives the camera a real sense of depth.
plant(-5.3,-3.5,0,1.0,black,True)
area('Large soft window',(-3.5,-3.5,5),(0,0,1),280,(1,.79,.57),5)
area('Portrait fill',(3,-4,3),(0,.1,1.5),130,(1,.87,.72),4)
area('Warm lounge bounce',(-4.5,1.2,3),(-3,2,1),130,(1,.61,.3),2)
area('Cool quiet edge',(5,0,4),(1,1,1.5),170,(.57,.68,1),3)

world=bpy.data.worlds.new('Evening ambient') if not bpy.data.worlds else bpy.data.worlds[0]
scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.2,.16,.12,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.1
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=3;scene.cycles.glossy_bounces=3
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    if any(d.type=='METAL' for d in prefs.devices):scene.cycles.device='GPU'
except Exception as exc:print('Using CPU rendering:',exc)
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.resolution_x=1920;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.1
scene.render.fps=24;scene.frame_end=90;scene.frame_set(1)

def camera(name,loc,target,lens):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
    o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens
    return o
cam=camera('Studio · main camera',(.3,-8.5,3),(.3,.5,1.8),30)
scene.camera=cam
cam.data.dof.use_dof=True;cam.data.dof.focus_distance=(cam.location-Vector((0,0,1.6))).length;cam.data.dof.aperture_fstop=8
print('Scene modeling complete. Saving editable source.',flush=True)

# Put the editable file in a useful material-preview camera view.
for screen_data in bpy.data.screens:
    for a in screen_data.areas:
        if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/aakaar-studio.blend'))

print('Exporting the web scene.',flush=True)
export_web(scene,OUT/'studio.glb')

if not os.environ.get('STUDIO_SKIP_RENDER'):
    if os.environ.get('STUDIO_PREVIEW'):
        scene.render.resolution_percentage=55;scene.cycles.samples=24
    scene.render.filepath=str(OUT/'studio-desktop.png');bpy.ops.render.render(write_still=True)
    # A dedicated portrait camera, rather than cropping away the characters on phones.
    mobile=camera('Studio · portrait camera',(2.5,-11.8,4.6),(0,.2,1.8),40)
    scene.camera=mobile;scene.render.resolution_x=1000;scene.render.resolution_y=1400
    scene.render.filepath=str(OUT/'studio-mobile.png');bpy.ops.render.render(write_still=True)
    scene.camera=cam;scene.render.resolution_x=1920;scene.render.resolution_y=1200
    scene.render.resolution_percentage=100
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/aakaar-studio.blend'))
print('STUDIO_BUILD_COMPLETE',str(OUT))

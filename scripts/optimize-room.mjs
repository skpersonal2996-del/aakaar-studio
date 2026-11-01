import {NodeIO} from '@gltf-transform/core'
import {ALL_EXTENSIONS} from '@gltf-transform/extensions'
import {dedup, prune, weld, textureCompress, meshopt} from '@gltf-transform/functions'
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer'
import sharp from 'sharp'
import {mkdir,stat,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
// Packages the Blender bake (blender/bake_cozy_room.py) for the website.
const root=fileURLToPath(new URL('../',import.meta.url))
const source=`${root}blender/generated/room-bake/`,target=`${root}public/studio/`
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready])
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder})
await mkdir(target,{recursive:true})
const doc=await io.read(`${source}room.glb`)
// No join/flatten/instance: the room is already one merged mesh and glow/leaf names are read at runtime.
// The atlas UVs look unused to prune (the website assigns the baked textures), so attributes are kept;
// leftover vertex colours from the source models are dropped instead.
for(const prim of doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()))
 for(const semantic of prim.listSemantics())if(semantic.startsWith('COLOR_'))prim.setAttribute(semantic,null)
await doc.transform(dedup(),weld(),prune({keepAttributes:true}),
 textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:88}),
 meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeTexcoord:16}))
await io.write(`${target}room.glb`,doc)
// Albedo keeps texture detail; the denoised lightmaps are smooth and compress well. 2K copies are for phones.
const images=[['room-albedo.png','room-albedo',4096,90],['room-light-warm.png','room-light-warm',4096,92],['room-light-night.png','room-light-night',4096,92]]
// Unbaked texels between UV islands are pure black. Mipmaps (and the 2K resize) would average them
// into the islands' edges as dark seams, so every gap takes the colour of its nearest island first
// (push-pull fill: average the covered texels down a pyramid, then fill gaps from the coarser levels).
function fillGaps(data,size){
 const levels=[{rgb:Float32Array.from(data),w:new Float32Array(size*size),size}]
 for(let i=0;i<size*size;i++)levels[0].w[i]=data[i*3]|data[i*3+1]|data[i*3+2]?1:0
 while(levels.at(-1).size>1){
  const prev=levels.at(-1),s=prev.size/2,rgb=new Float32Array(s*s*3),w=new Float32Array(s*s)
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
   let r=0,g=0,b=0,n=0
   for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){
    const j=(2*y+dy)*prev.size+2*x+dx,k=prev.w[j]
    r+=prev.rgb[j*3]*k;g+=prev.rgb[j*3+1]*k;b+=prev.rgb[j*3+2]*k;n+=k
   }
   const i=y*s+x
   if(n){rgb[i*3]=r/n;rgb[i*3+1]=g/n;rgb[i*3+2]=b/n;w[i]=1}
  }
  levels.push({rgb,w,size:s})
 }
 for(let l=levels.length-2;l>=0;l--){
  const cur=levels[l],up=levels[l+1]
  for(let y=0;y<cur.size;y++)for(let x=0;x<cur.size;x++){
   const i=y*cur.size+x
   if(cur.w[i])continue
   const j=(y>>1)*up.size+(x>>1)
   cur.rgb[i*3]=up.rgb[j*3];cur.rgb[i*3+1]=up.rgb[j*3+1];cur.rgb[i*3+2]=up.rgb[j*3+2];cur.w[i]=1
  }
 }
 return Buffer.from(Uint8ClampedArray.from(levels[0].rgb))
}

const report={glb_bytes:(await stat(`${target}room.glb`)).size}
for(const [file,name,size,quality] of images){
 const {data,info}=await sharp(`${source}${file}`).removeAlpha().raw().toBuffer({resolveWithObject:true})
 const filled=fillGaps(data,info.width)
 for(const [suffix,px] of [['',size],['-2k',2048]]){
  if(suffix&&px===size)continue
  const out=`${target}${name}${suffix}.webp`
  await sharp(filled,{raw:info}).resize(px,px).webp({quality,effort:6}).toFile(out)
  report[`${name}${suffix}`]=(await stat(out)).size
 }
}
// Live props (blender/export_live_props.py): they move with each character pair, so they are not baked.
for(const name of ['office-chair','laptop']){
 const prop=await io.read(`${root}blender/generated/live/${name}.glb`)
 await prop.transform(dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:88}),
  meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:16,quantizeTexcoord:16}))
 await io.write(`${target}${name}.glb`,prop)
 report[name]=(await stat(`${target}${name}.glb`)).size
}
console.log(JSON.stringify(report))
await writeFile(`${root}blender/generated/room-packaging.json`,JSON.stringify(report,null,2))

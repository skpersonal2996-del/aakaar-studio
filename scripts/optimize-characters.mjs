import {NodeIO} from '@gltf-transform/core'
import {ALL_EXTENSIONS} from '@gltf-transform/extensions'
import {dedup, prune, resample, textureCompress, meshopt} from '@gltf-transform/functions'
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer'
import sharp from 'sharp'
import {mkdir,stat,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
// Packages the seated characters (blender/seat_meshy_character.py) for the website: both casts, each with
// a TypingIdle loop and a Wave clip.
const root=fileURLToPath(new URL('../',import.meta.url))
const CAST={vinay:'guy',shruti:'girl','vinay-chibi':'chibi-guy','shruti-chibi':'chibi-girl'}
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready])
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder})
await mkdir(`${root}public/characters`,{recursive:true})
const report={}
for(const name of process.argv.slice(2).length?process.argv.slice(2):Object.keys(CAST)){
 const source=`${root}blender/generated/${CAST[name]}-seated.glb`,target=`${root}public/characters/${name}.glb`
 const doc=await io.read(source)
 const joints=doc.getRoot().listSkins()[0]?.listJoints().map(n=>n.getName())
 const clips=doc.getRoot().listAnimations().map(a=>a.getName())
 if(!joints?.includes('Head')||!clips.includes('TypingIdle')||!clips.includes('Wave'))throw new Error(`${name}: missing skeleton or animations (${clips})`)
 // The website makes the characters matte and drops Meshy's normal and roughness maps (Team.jsx fabricMaterial),
 // and plays only TypingIdle and Wave, so the rest is left out. Base colour at WebP quality 95 matches lossless on
 // the dark hair/skin edges at 3x zoom, at an eighth of the size. Geometry is already about 100K triangles from
 // decimate_meshy.py.
 for(const m of doc.getRoot().listMaterials()){m.setNormalTexture(null);m.setMetallicRoughnessTexture(null);m.setOcclusionTexture(null)}
 for(const a of doc.getRoot().listAnimations())if(!['TypingIdle','Wave'].includes(a.getName()))a.dispose()
 await doc.transform(resample({tolerance:1e-6}),dedup(),prune(),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture/,resize:[2048,2048],quality:95,effort:80}),
  meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:16,quantizeTexcoord:16,quantizeWeight:16}))
 await io.write(target,doc)
 const check=await io.read(target)
 if(check.getRoot().listSkins()[0].listJoints().length!==joints.length)throw new Error(`${name}: skeleton changed during packaging`)
 const entry={source:CAST[name],web_bytes:(await stat(target)).size,joints:joints.length,triangles:check.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0),animations:check.getRoot().listAnimations().map(a=>({name:a.getName(),channels:a.listChannels().length,duration_s:Math.max(...a.listSamplers().map(s=>s.getInput().getMax([])[0]))}))}
 report[name]=entry;console.log(name,JSON.stringify(entry))
}
await writeFile(`${root}blender/generated/character-packaging.json`,JSON.stringify(report,null,2))

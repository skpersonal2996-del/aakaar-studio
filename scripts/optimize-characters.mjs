import {NodeIO} from '@gltf-transform/core'
import {ALL_EXTENSIONS} from '@gltf-transform/extensions'
import {dedup, prune, resample, textureCompress, meshopt} from '@gltf-transform/functions'
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer'
import sharp from 'sharp'
import {mkdir,stat,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready])
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder})
await mkdir(`${root}public/characters`,{recursive:true})
const report={}
for(const name of process.argv.slice(2).length?process.argv.slice(2):['vinay','shruti']){
 const source=`${root}blender/generated/${name}-surface.glb`,target=`${root}public/characters/${name}-typing.glb`
 const doc=await io.read(source)
 const joints=doc.getRoot().listSkins()[0]?.listJoints().map(n=>n.getName())
 if(!joints?.includes('mixamorig:Head')||!doc.getRoot().listAnimations().length)throw new Error(`${name}: missing skeleton or animation`)
 // Use the padded atlas baked in Blender. Lossless maps prevent colour ringing
 // on the dark hair/skin boundaries. Geometry and animation are not decimated.
 await doc.transform(resample({tolerance:1e-6}),dedup(),prune(),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture/,resize:[2048,2048],lossless:true,effort:80}),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/normalTexture/,resize:[2048,2048],lossless:true,effort:80}),
  textureCompress({encoder:sharp,targetFormat:'webp',slots:/(metallicRoughnessTexture|occlusionTexture)/,resize:[1024,1024],lossless:true,effort:80}),
  meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:16,quantizeTexcoord:16,quantizeWeight:16}))
 await io.write(target,doc)
 const check=await io.read(target),animations=check.getRoot().listAnimations()
 if(check.getRoot().listSkins()[0].listJoints().length!==joints.length)throw new Error(`${name}: skeleton changed during packaging`)
 const entry={source_bytes:(await stat(source)).size,web_bytes:(await stat(target)).size,joints:joints.length,triangles:check.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0),animations:animations.map(a=>({name:a.getName(),channels:a.listChannels().length,duration_s:Math.max(...a.listSamplers().map(s=>s.getInput().getMax([])[0]))})),textures:check.getRoot().listTextures().map(t=>({name:t.getName(),mime:t.getMimeType(),size:t.getSize()}))}
 report[name]=entry;console.log(name,JSON.stringify(entry))
}
await writeFile(`${root}blender/generated/character-packaging.json`,JSON.stringify(report,null,2))

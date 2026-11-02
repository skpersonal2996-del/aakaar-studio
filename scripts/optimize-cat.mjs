import {NodeIO} from '@gltf-transform/core'
import {ALL_EXTENSIONS} from '@gltf-transform/extensions'
import {dedup, prune, resample, meshopt} from '@gltf-transform/functions'
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer'
import {stat} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
// Packages the cat (blender/prepare_cat.py) for the website: compressed geometry and animation. The material is
// replaced at runtime (Cat.jsx), so Blender's specular/IOR extensions are left out.
const root=fileURLToPath(new URL('../',import.meta.url))
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready])
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder})
const doc=await io.read(`${root}blender/generated/cat.glb`)
for(const ext of doc.getRoot().listExtensionsUsed())if(/specular|ior/.test(ext.extensionName))ext.dispose()
await doc.transform(resample({tolerance:1e-5}),dedup(),prune(),
 meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:16,quantizeTexcoord:16,quantizeWeight:16}))
const target=`${root}public/studio/cat.glb`
await io.write(target,doc)
const check=await io.read(target)
console.log('cat',(await stat(target)).size,'bytes,',check.getRoot().listAnimations().map(a=>a.getName()).join(', '))

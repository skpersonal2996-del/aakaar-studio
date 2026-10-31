import {mkdir,writeFile} from 'node:fs/promises'
import sharp from 'sharp'
const materials={oak:'wood_table_001',floor:'wood_floor',linen:'rough_linen',leather:'fabric_leather_01',walnut:'brown_planks_04'}
const raw=new URL('../blender/generated/material-sources/',import.meta.url),out=new URL('../public/materials/',import.meta.url)
await mkdir(raw,{recursive:true});await mkdir(out,{recursive:true})
const license=[]
for(const [name,id] of Object.entries(materials)){
 const catalogResponse=await fetch(`https://api.polyhaven.com/files/${id}`)
 if(!catalogResponse.ok)throw new Error(`Metadata: ${catalogResponse.status}`)
 const metadata=await catalogResponse.json()
 for(const [channel,key] of [['diff','Diffuse'],['normal','nor_gl'],['arm','arm']]){
  const source=metadata[key]['1k'].jpg
  const response=await fetch(source.url);if(!response.ok)throw new Error(`${response.status}: ${source.url}`)
  const bytes=Buffer.from(await response.arrayBuffer())
  await writeFile(new URL(`${name}-${channel}.jpg`,raw),bytes)
  let image=sharp(bytes)
  if(name==='linen' && channel==='diff') image=image.grayscale().linear(1,65)
  await image.resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:channel==='normal'?94:86,effort:6}).toFile(new URL(`${name}-${channel}.webp`,out).pathname)
  license.push({name,channel,asset:id,source:source.url,sourceMD5:source.md5,license:'CC0-1.0',assetPage:`https://polyhaven.com/a/${id}`})
 }
 console.log(`Prepared ${name}: ${id}`)
}
await writeFile(new URL('sources.json',out),JSON.stringify(license,null,2)+'\n')

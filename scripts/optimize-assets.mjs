import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, join, meshopt, prune, resample, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const dir = `${root}public/studio/`
const source = `${root}blender/generated/`
await MeshoptEncoder.ready
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(`${source}studio.glb`)
// The Blender grain buffers contain linear color. glTF base color images use sRGB.
// Convert once during packaging, and omit unsupported procedural bump connections.
for (const texture of doc.getRoot().listTextures()) {
  if (!['oak-grain', 'walnut-grain'].includes(texture.getName())) continue
  const { data, info } = await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) {
    const value = data[i + c] / 255
    data[i + c] = Math.round(255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055))
  }
  texture.setImage(await sharp(data, { raw: info }).png().toBuffer())
}
for (const material of doc.getRoot().listMaterials()) {
  if (/^(Warm oak|Walnut)/.test(material.getName())) material.setNormalTexture(null)
}
await doc.transform(resample(), dedup(), flatten(), join(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .55, error: .001 }), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write(`${dir}studio-web.glb`, doc)
for (const name of process.argv.includes('--model-only') ? [] : ['desktop', 'mobile']) {
  await sharp(`${source}studio-${name}.png`).webp({ quality: 88, effort: 6 }).toFile(`${dir}studio-${name}.webp`)
}
for (const name of process.argv.includes('--model-only') ? ['studio-web.glb'] : ['studio-web.glb', 'studio-desktop.webp', 'studio-mobile.webp']) console.log(name, `${((await stat(`${dir}${name}`)).size / 1024).toFixed(0)} KB`)

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// Local authoring tools only. This module is excluded from production builds.
export default function DevSceneTools() {
  const scene=useThree(s=>s.scene)
  useEffect(()=>{
    const exportRoom=async()=>{
      try {
        const {GLTFExporter}=await import('three/examples/jsm/exporters/GLTFExporter.js')
        const copy=scene.clone(true), actors=[]
        copy.traverse(object=>{if(object.userData.studioActor)actors.push(object)})
        actors.forEach(object=>object.removeFromParent())
        const data=await new GLTFExporter().parseAsync(copy,{binary:true,onlyVisible:true})
        const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'})),link=document.createElement('a')
        link.href=url;link.download='aakaar-room.glb';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
        window.dispatchEvent(new CustomEvent('studio:export-status',{detail:'Room exported'}))
      }catch(error){window.dispatchEvent(new CustomEvent('studio:export-status',{detail:error.message}))}
    }
    window.addEventListener('studio:export-room',exportRoom)
    return()=>window.removeEventListener('studio:export-room',exportRoom)
  },[scene])
  return null
}

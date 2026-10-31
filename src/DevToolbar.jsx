import { useEffect,useState } from 'react'
import {useStore} from './store'
export default function DevToolbar(){
 const [status,setStatus]=useState('')
 useEffect(()=>{const change=e=>setStatus(e.detail);window.addEventListener('studio:export-status',change);return()=>window.removeEventListener('studio:export-status',change)},[])
 return <aside aria-label="Local scene authoring" style={{position:'fixed',zIndex:100,left:12,top:80,display:'flex',gap:6,padding:8,background:'#15110feb',color:'#fff',border:'1px solid #88705c',borderRadius:8,font:'12px system-ui',flexWrap:'wrap',maxWidth:550}}>
  <button onClick={()=>useStore.getState().setPeek('developer')}>Inspect Vinay</button>
  <button onClick={()=>useStore.getState().setPeek('designer')}>Inspect Shruti</button>
  <button onClick={()=>useStore.getState().resetView()}>Home view</button>
  <a href="?inspect=source">Source asset</a><a href="?inspect=unlit">Unlit</a><a href="?inspect=nonormal">No normal maps</a><a href="?inspect=noshadow">No actor shadows</a><a href="?inspect=nomip">No mipmaps</a><a href="?authoring">Normal rendering</a>
  <button onClick={()=>{setStatus('Exporting room…');window.dispatchEvent(new Event('studio:export-room'))}}>Export Blender room</button>
  <span role="status">{status}</span>
 </aside>
}

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Studio } from './Studio'
import { useStore } from '../store'

export default function StudioCanvas({onReady}) {
  return <Canvas shadows flat frameloop="demand" dpr={[1,1.5]}
    gl={{antialias:false,powerPreference:'high-performance'}}
    camera={{fov:42,near:.05,far:60,position:[10,7.5,13.5]}}
    onPointerMissed={e => { const s = useStore.getState(); if ((s.active || s.peek) && e.type === 'click') s.close() }}>
    <Suspense fallback={null}><Studio onReady={onReady} /></Suspense>
  </Canvas>
}

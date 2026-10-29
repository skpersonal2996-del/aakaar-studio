import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Studio } from './scene/Studio'
import { Overlay } from './ui/Overlay'
import { useStore } from './store'

// Canvas textures (neon, ID cards, screens) are painted with web fonts, so wait for them first.
function useFonts() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const fonts = ['500 100px "Comfortaa"', '500 40px "Space Grotesk"', '700 40px "Space Grotesk"', '500 20px "JetBrains Mono"']
    const timeout = new Promise((r) => setTimeout(r, 3500))
    Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), timeout])
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])
  return ready
}

export default function App() {
  const fontsReady = useFonts()
  const [sceneReady, setSceneReady] = useState(false)
  const active = useStore((s) => s.active)
  const close = useStore((s) => s.close)

  return (
    <>
      <div className={`stage ${active ? 'is-focused' : ''}`}>
        {fontsReady && (
          <Canvas
            shadows
            flat
            frameloop="demand"
            dpr={[1, 2]}
            gl={{ antialias: false, powerPreference: 'high-performance' }}
            camera={{ fov: 42, near: 0.05, far: 60, position: [10, 7.5, 13.5] }}
            onPointerMissed={(e) => {
              if ((active || useStore.getState().peek) && e.type === 'click') close()
            }}>
            <Suspense fallback={null}>
              <Studio onReady={() => setSceneReady(true)} />
            </Suspense>
          </Canvas>
        )}
      </div>
      <Overlay ready={sceneReady} />
    </>
  )
}

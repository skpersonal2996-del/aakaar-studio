import { Component, Suspense, lazy, useEffect, useState } from 'react'
import { Overlay } from './ui/Overlay'
import { useStore } from './store'
import { NAV } from './content'

const StudioCanvas = lazy(() => import('./scene/StudioCanvas'))
const DevToolbar = import.meta.env.DEV && /[?&](inspect|authoring)/.test(location.search) ? lazy(()=>import('./DevToolbar')) : null

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function App() {
  const [fontsReady, setFontsReady] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const active = useStore((s) => s.active)
  const focus = useStore((s) => s.focus)
  const close = useStore((s) => s.close)
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => { if (alive) setFontsReady(true) }, 2500)
    Promise.all(['500 100px "Comfortaa Variable"','500 40px "Space Grotesk Variable"','700 40px "Space Grotesk Variable"','400 20px "JetBrains Mono"'].map(f => document.fonts.load(f)))
      .catch(() => {}).finally(() => { if (alive) { clearTimeout(timer); setFontsReady(true) } })
    const fromHash = () => { const id = location.hash.slice(1); NAV.includes(id) ? focus(id) : close() }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => { alive = false; clearTimeout(timer); window.removeEventListener('hashchange', fromHash) }
  }, [focus, close])
  useEffect(() => { history.replaceState(null,'',active ? `#${active}` : location.pathname + location.search) }, [active])
  return <>
    <div className={`stage ${active ? 'is-focused' : ''}`}>
      {fontsReady && <SceneBoundary onError={() => { setFailed(true); setSceneReady(true) }}><Suspense fallback={null}><StudioCanvas onReady={() => setSceneReady(true)} /></Suspense></SceneBoundary>}
    </div>
    {failed && <p className="scene-failure" role="status">3D couldn’t load. You can still explore every section below.</p>}
    <Overlay ready={sceneReady} />
    {DevToolbar && <Suspense fallback={null}><DevToolbar /></Suspense>}
  </>
}

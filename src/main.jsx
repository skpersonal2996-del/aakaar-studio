import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource-variable/comfortaa'
import '@fontsource-variable/space-grotesk'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/caveat/500.css'
import './styles.css'
import './refinements.css'

createRoot(document.getElementById('root')).render(<App />)

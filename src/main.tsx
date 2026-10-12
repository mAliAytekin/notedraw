import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'tldraw/tldraw.css'
import { App } from './app/App'
import { DesktopApp } from './app/DesktopApp'
import { isTauri } from '@tauri-apps/api/core'
import './app/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isTauri() ? <DesktopApp /> : <App />}</StrictMode>,
)

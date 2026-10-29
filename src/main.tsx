import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

try {
  const cachedTheme = localStorage.getItem('nexo_theme')
  if (cachedTheme) document.documentElement.dataset.theme = cachedTheme
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')
const productionHost = typeof location !== 'undefined' && location.hostname === 'lunanav.vercel.app'

export const API_BASE_URL = configured || (productionHost
  ? 'https://lunara-cqiq.onrender.com'
  : 'http://127.0.0.1:8000')

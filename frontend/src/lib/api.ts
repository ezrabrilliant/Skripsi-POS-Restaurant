import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

// baseURL '/api' diteruskan oleh proxy Vite ke backend Express (lihat vite.config.ts).
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Skip ngrok browser warning for API calls
  },
  timeout: 30000, // 30 seconds for slow networks
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    // Normalisasi pesan: backend mengirim { success:false, message:'...' }.
    // Kita timpa error.message dengan pesan dari backend sehingga semua
    // `toast.error(err.message)` di mutasi langsung menampilkan pesan asli
    // (mis. "PIN sudah dipakai pengguna lain") alih-alih "Request failed
    // with status code 409".
    const backendMessage = error.response?.data?.message
    if (typeof backendMessage === 'string' && backendMessage.length > 0) {
      error.message = backendMessage
    }
    return Promise.reject(error)
  }
)

export default api

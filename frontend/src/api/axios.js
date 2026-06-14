import axios from 'axios'

const IS_PROD = import.meta.env.PROD
const baseURL = IS_PROD ? window.location.origin : `http://${window.location.hostname}:4000`

const api = axios.create({
  baseURL,
  withCredentials: true
})

// Interceptor para inyectar token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const activeInstanceId = localStorage.getItem('activeInstanceId')
    if (activeInstanceId) {
      config.headers['x-instance-id'] = activeInstanceId
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores comunes (como token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Si el backend retorna 401 o 403, podemos limpiar el token expirado
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

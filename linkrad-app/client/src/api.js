import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach auth token to every request
api.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('linkrad_auth')
    if (stored) {
      const { token } = JSON.parse(stored)
      config.headers['Authorization'] = `Bearer ${token}`
    }
  } catch {}
  return config
})

// On 401, clear stale session and reload to login screen
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('linkrad_auth')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export const loginUser  = (username, password) => api.post('/auth/login', { username, password }).then(r => r.data)
export const logoutUser = () => api.post('/auth/logout').then(r => r.data)

export const getSites = () => api.get('/sites').then(r => r.data)
export const updateSites = (data) => api.put('/sites', data).then(r => r.data)

export const getAnnualPL = () => api.get('/pl/annual').then(r => r.data)
export const updateAnnualPL = (data) => api.put('/pl/annual', data).then(r => r.data)

export const getMonthlyPL = () => api.get('/pl/monthly').then(r => r.data)
export const updateMonthlyPL = (data) => api.put('/pl/monthly', data).then(r => r.data)

export const getAnnualCF = () => api.get('/cf/annual').then(r => r.data)
export const updateAnnualCF = (data) => api.put('/cf/annual', data).then(r => r.data)

export const getMonthlyCF = () => api.get('/cf/monthly').then(r => r.data)
export const updateMonthlyCF = (data) => api.put('/cf/monthly', data).then(r => r.data)

export const getBS = () => api.get('/bs').then(r => r.data)
export const updateBS = (data) => api.put('/bs', data).then(r => r.data)

export const getBreakeven = () => api.get('/breakeven').then(r => r.data)
export const updateBreakeven = (data) => api.put('/breakeven', data).then(r => r.data)

export const getActuals = () => api.get('/actuals').then(r => r.data)
export const saveActual = (key, data) => api.put(`/actuals/${key}`, data).then(r => r.data)
export const deleteActual = (key) => api.delete(`/actuals/${key}`).then(r => r.data)

export const getTasks       = () => api.get('/tasks').then(r => r.data)
export const createTask     = (data) => api.post('/tasks', data).then(r => r.data)
export const updateTask     = (id, data) => api.put(`/tasks/${id}`, data).then(r => r.data)
export const addComment     = (id, text) => api.post(`/tasks/${id}/comments`, { text }).then(r => r.data)
export const deleteTask     = (id) => api.delete(`/tasks/${id}`).then(r => r.data)

export default api

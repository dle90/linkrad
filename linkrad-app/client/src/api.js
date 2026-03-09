import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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

import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PL from './pages/PL'
import CF from './pages/CF'
import BalanceSheet from './pages/BalanceSheet'
import Breakeven from './pages/Breakeven'
import SiteList from './pages/SiteList'
import Actuals from './pages/Actuals'
import Workflow from './pages/Workflow'
import RIS from './pages/RIS'
import HIS from './pages/HIS'
import CRM from './pages/CRM'

function AppRoutes() {
  const { auth } = useAuth()

  if (!auth) return <Login />

  const isWorkflowUser = auth.role && auth.role !== 'guest'
  const isRISUser = auth.role && auth.role !== 'guest'

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {auth.role === 'admin' && <Route path="/actuals" element={<Actuals />} />}
        {isWorkflowUser && <Route path="/workflow" element={<Workflow />} />}
        {isRISUser && <Route path="/ris" element={<RIS />} />}
        {isWorkflowUser && <Route path="/his" element={<HIS />} />}
        <Route path="/pl" element={<PL />} />
        <Route path="/cf" element={<CF />} />
        <Route path="/bs" element={<BalanceSheet />} />
        <Route path="/breakeven" element={<Breakeven />} />
        <Route path="/sites" element={<SiteList />} />
        <Route path="/crm" element={<CRM />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

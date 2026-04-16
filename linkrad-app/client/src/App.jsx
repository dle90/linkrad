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
import Registration from './pages/Registration'
import CRM from './pages/CRM'
import KPISales from './pages/KPISales'
import Marketing from './pages/Marketing'
import Teleradiology, { StudyDetailPage } from './pages/Teleradiology'
import TeleradAdmin from './pages/TeleradAdmin'
import TeleradReading from './pages/TeleradReading'
import Billing from './pages/Billing'
import Inventory from './pages/Inventory'
import Catalogs from './pages/Catalogs'
import BookingForm from './pages/BookingForm'
import PatientLogin from './pages/PatientLogin'
import PatientPortal from './pages/PatientPortal'
import PartnerLogin from './pages/PartnerLogin'
import PartnerPortal from './pages/PartnerPortal'
import HRManagement from './pages/HRManagement'

function AuthenticatedRoutes() {
  const { auth } = useAuth()

  if (!auth) return <Login />

  const isWorkflowUser = auth.role && auth.role !== 'guest'
  const isRISUser = auth.role && auth.role !== 'guest'

  return (
    <Routes>
      {/* Full-screen study detail (opens in new tab) */}
      {isWorkflowUser && <Route path="/teleradiology/study/:studyId" element={<StudyDetailPage />} />}

      {/* All other routes wrapped in Layout */}
      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {auth.role === 'admin' && <Route path="/actuals" element={<Actuals />} />}
            {isWorkflowUser && <Route path="/workflow" element={<Workflow />} />}
            {isRISUser && <Route path="/ris" element={<RIS />} />}
            {isWorkflowUser && <Route path="/registration" element={<Registration />} />}
            {isWorkflowUser && <Route path="/teleradiology" element={<Teleradiology />} />}
            {auth.role === 'admin' && <Route path="/telerad-admin" element={<TeleradAdmin />} />}
            {isWorkflowUser && <Route path="/telerad-reading" element={<TeleradReading />} />}
            {isWorkflowUser && <Route path="/billing" element={<Billing />} />}

            {isWorkflowUser && <Route path="/inventory" element={<Inventory />} />}
            {isWorkflowUser && <Route path="/catalogs" element={<Catalogs />} />}
            {auth.role === 'admin' && <Route path="/hr" element={<HRManagement />} />}
            <Route path="/pl" element={<PL />} />
            <Route path="/cf" element={<CF />} />
            <Route path="/bs" element={<BalanceSheet />} />
            <Route path="/breakeven" element={<Breakeven />} />
            <Route path="/sites" element={<SiteList />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/kpi-sales" element={<KPISales />} />
            <Route path="/marketing" element={<Marketing />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - no auth required */}
      <Route path="/booking" element={<BookingForm />} />
      <Route path="/patient-login" element={<PatientLogin />} />
      <Route path="/patient-portal" element={<PatientPortal />} />
      <Route path="/partner-login" element={<PartnerLogin />} />
      <Route path="/partner-portal" element={<PartnerPortal />} />
      {/* All other routes require auth */}
      <Route path="/*" element={<AuthenticatedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AnnualPL from './pages/AnnualPL'
import MonthlyPL from './pages/MonthlyPL'
import SitePL from './pages/SitePL'
import BalanceSheet from './pages/BalanceSheet'
import AnnualCF from './pages/AnnualCF'
import MonthlyCF from './pages/MonthlyCF'
import Breakeven from './pages/Breakeven'
import SiteList from './pages/SiteList'
import Actuals from './pages/Actuals'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/actuals" element={<Actuals />} />
        <Route path="/pl/annual" element={<AnnualPL />} />
        <Route path="/pl/monthly" element={<MonthlyPL />} />
        <Route path="/pl/site/:siteId" element={<SitePL />} />
        <Route path="/bs" element={<BalanceSheet />} />
        <Route path="/cf/annual" element={<AnnualCF />} />
        <Route path="/cf/monthly" element={<MonthlyCF />} />
        <Route path="/breakeven" element={<Breakeven />} />
        <Route path="/sites" element={<SiteList />} />
      </Routes>
    </Layout>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AIChat from './pages/AIChat'
import Dashboard from './pages/Dashboard'
import Matters from './pages/Matters'
import MatterDetail from './pages/MatterDetail'
import Contracts from './pages/Contracts'
import Spend from './pages/Spend'
import Insights from './pages/Insights'
import KnowledgeBase from './pages/KnowledgeBase'
import Login from './pages/Login'
import Billing from './pages/Billing'
import Contacts from './pages/Contacts'
import MatterTypes from './pages/MatterTypes'
import AuditLog from './pages/AuditLog'
import MatterSpend from './pages/MatterSpend'
import CrossMatterReport from './pages/CrossMatterReport'
import IntakePortal from './pages/IntakePortal'
import IntakeFormPage from './pages/IntakeForm'
import IntakeAdmin from './pages/IntakeAdmin'
import IntakeFormBuilder from './pages/IntakeFormBuilder'
import Tasks from './pages/Tasks'
import CustomFields from './pages/CustomFields'
import ContractDetail from './pages/ContractDetail'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public intake pages */}
      <Route path="/intake" element={<IntakePortal />} />
      <Route path="/intake/:formId" element={<IntakeFormPage />} />
      {/* AI Chat as the main interface */}
      <Route path="/" index element={<AIChat />} />
      <Route path="/chat" element={<AIChat />} />
      <Route path="/dashboard" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="matters" element={<Matters />} />
        <Route path="matters/:id" element={<MatterDetail />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/:id" element={<ContractDetail />} />
        <Route path="spend" element={<Spend />} />
        <Route path="insights" element={<Insights />} />
        <Route path="kb" element={<KnowledgeBase />} />
        <Route path="billing" element={<Billing />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="matter-types" element={<MatterTypes />} />
        <Route path="audit/:matterId" element={<AuditLog />} />
        <Route path="matters/:id/spend" element={<MatterSpend />} />
        <Route path="reports" element={<CrossMatterReport />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="custom-fields" element={<CustomFields />} />
        <Route path="intake/admin" element={<IntakeAdmin />} />
        <Route path="intake/form-builder" element={<IntakeFormBuilder />} />
      </Route>
    </Routes>
  )
}

export default App

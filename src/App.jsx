import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import BottomNav from '@/components/layout/BottomNav'
import Home from '@/pages/Home'
import Dashboard from '@/pages/Dashboard'
import DashboardSettle from '@/pages/DashboardSettle'
import Borrowers from '@/pages/Borrowers'
import BorrowerDetail from '@/pages/BorrowerDetail'
import NewLoan from '@/pages/NewLoan'
import Login from '@/pages/Login'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  const { session } = useAuth()

  // Still checking session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  // Not logged in
  if (!session) return <Login />

  // Logged in
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/weekly" element={<Dashboard type="weekly" />} />
        <Route path="/monthly" element={<Dashboard type="monthly" />} />
        <Route path="/settle" element={<DashboardSettle />} />
        <Route path="/borrowers" element={<Borrowers />} />
        <Route path="/borrowers/:id" element={<BorrowerDetail />} />
        <Route path="/new-loan" element={<NewLoan />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import FAB from '@/components/layout/FAB'
import { useDashboardStats, useCollectedByMonth } from '@/hooks/usePayments'
import { useLoans } from '@/hooks/useLoans'
import { formatPeso } from '@/lib/loanUtils'
import { format } from 'date-fns'

function StatTile({ label, value, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`bg-white rounded-2xl border p-4 flex flex-col gap-1 text-left w-full transition-colors ${
        onClick ? 'hover:bg-blue-50 hover:border-blue-200 active:scale-[0.97] cursor-pointer' : 'cursor-default'
      } ${accent ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}
    >
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-xl font-bold text-gray-900 truncate">{value}</span>
    </button>
  )
}

function ActiveLoansModal({ open, onClose, loans }) {
  const navigate = useNavigate()
  return (
    <Modal open={open} onClose={onClose} title="Active Loans">
      {loans.length === 0 ? (
        <p className="text-center text-gray-400 py-6">No active loans.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50"
              onClick={() => { navigate(`/borrowers/${loan.borrower?.id}`); onClose() }}
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">{loan.borrower?.name}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(loan.loan_date), 'MMM d, yyyy')} &nbsp;·&nbsp; {loan.interest_rate}% interest
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatPeso(loan.principal)}</p>
                <p className="text-xs text-gray-500">Due: {formatPeso(loan.total_due)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function CollectedChartModal({ open, onClose, type }) {
  const { data: chartData = [], isLoading } = useCollectedByMonth(type)
  return (
    <Modal open={open} onClose={onClose} title="Collected per Month">
      {isLoading ? (
        <p className="text-center text-gray-400 py-6">Loading chart...</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                width={45}
              />
              <Tooltip
                formatter={(v) => [formatPeso(v), 'Collected']}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ borderRadius: '0.5rem', fontSize: 12 }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Modal>
  )
}

export default function Dashboard({ type }) {
  const title = type === 'weekly' ? 'Weekly Dashboard' : 'Monthly Dashboard'
  const { data: stats, isLoading: statsLoading } = useDashboardStats(type)
  const { data: loans = [] } = useLoans(type)
  const [showActiveLoans, setShowActiveLoans] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const activeLoans = loans.filter((l) => l.status === 'active')

  return (
    <PageWrapper title={title}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatTile
          label="Total Lent"
          value={statsLoading ? '...' : formatPeso(stats?.totalLent || 0)}
        />
        <StatTile
          label="Outstanding"
          value={statsLoading ? '...' : formatPeso(stats?.outstanding || 0)}
        />
        <StatTile
          label="Collected (Month)"
          value={statsLoading ? '...' : formatPeso(stats?.collected || 0)}
          onClick={() => setShowChart(true)}
          accent
        />
        <StatTile
          label="Active Loans"
          value={statsLoading ? '...' : String(stats?.activeCount || 0)}
          onClick={() => setShowActiveLoans(true)}
          accent
        />
      </div>

      <p className="text-xs text-gray-400 text-center mt-2">
        Tap "Collected" to see monthly chart. Tap "Active Loans" to view list.
      </p>

      <ActiveLoansModal
        open={showActiveLoans}
        onClose={() => setShowActiveLoans(false)}
        loans={activeLoans}
      />
      <CollectedChartModal
        open={showChart}
        onClose={() => setShowChart(false)}
        type={type}
      />
      <FAB />
    </PageWrapper>
  )
}

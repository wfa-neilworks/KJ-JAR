import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Banknote, TrendingUp, PiggyBank, ClipboardList, ChevronRight } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import FAB from '@/components/layout/FAB'
import { useDashboardStats, useCollectedByMonth } from '@/hooks/usePayments'
import { useLoans } from '@/hooks/useLoans'
import { formatPeso } from '@/lib/loanUtils'
import { format } from 'date-fns'

const tileConfig = {
  lent:        { icon: Banknote,      bg: 'bg-blue-500',   light: 'bg-blue-50',   border: 'border-blue-100', text: 'text-blue-600' },
  outstanding: { icon: TrendingUp,    bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-600' },
  collected:   { icon: PiggyBank,     bg: 'bg-green-500',  light: 'bg-green-50',  border: 'border-green-100', text: 'text-green-600' },
  active:      { icon: ClipboardList, bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-600' },
}

function StatTile({ tileKey, label, value, onClick, sublabel }) {
  const { icon: Icon, bg, light, border, text } = tileConfig[tileKey]
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`${light} ${border} border rounded-2xl p-4 flex flex-col gap-3 text-left w-full transition-all active:scale-[0.97] ${
        onClick ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`${bg} p-2 rounded-xl`}>
          <Icon size={20} className="text-white" strokeWidth={2} />
        </div>
        {onClick && <ChevronRight size={16} className="text-gray-400" />}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className={`text-xl font-bold ${text} truncate`}>{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
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
              className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition-colors"
              onClick={() => { navigate(`/borrowers/${loan.borrower?.id}`); onClose() }}
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">{loan.borrower?.name}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(loan.loan_date), 'MMM d, yyyy')} · {loan.interest_rate}% interest
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
    <Modal open={open} onClose={onClose} title="Monthly Collections">
      {isLoading ? (
        <p className="text-center text-gray-400 py-6">Loading chart...</p>
      ) : (
        <div className="h-64 w-full">
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
                contentStyle={{ borderRadius: '0.75rem', fontSize: 12, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="amount" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Modal>
  )
}

export default function Dashboard({ type }) {
  const isWeekly = type === 'weekly'
  const title = isWeekly ? 'Weekly Dashboard' : 'Monthly Dashboard'
  const { data: stats, isLoading: statsLoading } = useDashboardStats(type)
  const { data: loans = [] } = useLoans(type)
  const [showActiveLoans, setShowActiveLoans] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const activeLoans = loans.filter((l) => l.status === 'active')
  const loading = statsLoading ? '...' : null

  return (
    <PageWrapper title={title}>
      {/* Header banner */}
      <div className={`rounded-2xl p-4 mb-5 text-white ${isWeekly ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-purple-600 to-purple-400'}`}>
        <p className="text-sm font-medium opacity-80 mb-1">{isWeekly ? 'Weekly Loans' : 'Monthly Loans'}</p>
        <p className="text-3xl font-bold">{loading || formatPeso(stats?.totalLent || 0)}</p>
        <p className="text-xs opacity-70 mt-1">Total capital lent out</p>
      </div>

      {/* Stat tiles grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          tileKey="lent"
          label="Total Lent"
          value={loading || formatPeso(stats?.totalLent || 0)}
          sublabel="Active capital"
        />
        <StatTile
          tileKey="outstanding"
          label="Outstanding"
          value={loading || formatPeso(stats?.outstanding || 0)}
          sublabel="Capital + interest"
        />
        <StatTile
          tileKey="collected"
          label="Collected"
          value={loading || formatPeso(stats?.collected || 0)}
          sublabel="This month · tap for chart"
          onClick={() => setShowChart(true)}
        />
        <StatTile
          tileKey="active"
          label="Active Loans"
          value={loading || String(stats?.activeCount || 0)}
          sublabel="Tap to view list"
          onClick={() => setShowActiveLoans(true)}
        />
      </div>

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

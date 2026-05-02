import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import PageWrapper from '@/components/layout/PageWrapper'
import { useLoans } from '@/hooks/useLoans'
import { useSettleLoans } from '@/hooks/useSettle'
import { formatPeso } from '@/lib/loanUtils'
import { cn } from '@/lib/utils'

function statusBadge(status) {
  return status === 'active'
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-500'
}

function typeBadge(type) {
  if (type === 'weekly') return 'bg-purple-100 text-purple-700'
  if (type === 'monthly') return 'bg-blue-100 text-blue-700'
  return 'bg-teal-100 text-teal-700'
}

function LoanRow({ loan, loanType, onClick }) {
  const isPaid = loan.status === 'completed'
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-semibold text-gray-900 truncate">{loan.borrower?.name}</span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', typeBadge(loanType))}>
            {loanType === 'weekly' ? 'Weekly' : loanType === 'monthly' ? 'Monthly' : 'To Settle'}
          </span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusBadge(loan.status))}>
            {loan.status}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {formatPeso(loan.principal)}
          {loanType !== 'settle' && (
            <> &nbsp;·&nbsp; {loan.interest_rate}% interest</>
          )}
          &nbsp;·&nbsp; {format(new Date(loan.loan_date || loan.created_at), 'MMM d, yyyy')}
        </p>
      </div>
    </div>
  )
}

export default function Loans() {
  const navigate = useNavigate()
  const [typeTab, setTypeTab] = useState('All')
  const [statusTab, setStatusTab] = useState('All')

  const { data: weeklyLoans = [], isLoading: wLoading } = useLoans('weekly')
  const { data: monthlyLoans = [], isLoading: mLoading } = useLoans('monthly')
  const { data: settleLoans = [], isLoading: sLoading } = useSettleLoans()

  const isLoading = wLoading || mLoading || sLoading

  // Tag each loan with its type for unified rendering
  const tagged = [
    ...weeklyLoans.map((l) => ({ ...l, _type: 'weekly' })),
    ...monthlyLoans.map((l) => ({ ...l, _type: 'monthly' })),
    ...settleLoans.map((l) => ({ ...l, _type: 'settle' })),
  ]

  // Filter by type tab
  const byType = tagged.filter((l) => {
    if (typeTab === 'All') return true
    if (typeTab === 'Weekly') return l._type === 'weekly'
    if (typeTab === 'Monthly') return l._type === 'monthly'
    if (typeTab === 'To Settle') return l._type === 'settle'
    return true
  })

  // Filter by status tab (only shown when not on All type)
  const byStatus = byType.filter((l) => {
    if (statusTab === 'All') return true
    if (statusTab === 'Active') return l.status === 'active'
    if (statusTab === 'Completed') return l.status === 'completed'
    return true
  })

  // Active first, then completed; within same status keep original order (created_at desc)
  const sorted = [...byStatus].sort((a, b) => {
    if (a.status === b.status) return 0
    return a.status === 'active' ? -1 : 1
  })

  return (
    <PageWrapper title="Loans">
      {/* Filters row */}
      <div className="flex gap-3 mb-4">
        <select
          value={typeTab}
          onChange={(e) => { setTypeTab(e.target.value); setStatusTab('All') }}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Types</option>
          <option value="Weekly">Weekly</option>
          <option value="Monthly">Monthly</option>
          <option value="To Settle">To Settle</option>
        </select>
        <select
          value={statusTab}
          onChange={(e) => setStatusTab(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : sorted.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No loans found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((loan) => (
            <LoanRow
              key={`${loan._type}-${loan.id}`}
              loan={loan}
              loanType={loan._type}
              onClick={() => navigate(`/borrowers/${loan.borrower_id || loan.borrower?.id}`)}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}

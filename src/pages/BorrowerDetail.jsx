import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Link, Shield } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import { useBorrowers } from '@/hooks/useBorrowers'
import { useLoansByBorrower } from '@/hooks/useLoans'
import { formatPeso } from '@/lib/loanUtils'
import { format } from 'date-fns'

function LoanCard({ loan }) {
  const unpaid = loan.payments?.filter((p) => !p.paid_at) || []
  const paid = loan.payments?.filter((p) => p.paid_at) || []

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            loan.type === 'weekly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {loan.type.charAt(0).toUpperCase() + loan.type.slice(1)}
          </span>
          <p className="mt-1.5 text-lg font-semibold text-gray-900">{formatPeso(loan.principal)}</p>
          <p className="text-sm text-gray-500">
            Total due: <span className="font-medium text-gray-700">{formatPeso(loan.total_due)}</span>
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {loan.status}
        </span>
      </div>

      <div className="text-xs text-gray-500 flex gap-3">
        <span>Loan date: {format(new Date(loan.loan_date), 'MMM d, yyyy')}</span>
        <span>Interest: {loan.interest_rate}%</span>
      </div>

      {loan.payments && loan.payments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Payments</p>
          {loan.payments.map((p) => (
            <div key={p.id} className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-lg ${
              p.paid_at ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              <span className="text-gray-600">
                {loan.type === 'weekly' ? `Week ${p.week_number}` : 'Payment'} — {format(new Date(p.due_date), 'MMM d, yyyy')}
              </span>
              <span className={`font-medium ${p.paid_at ? 'text-green-600' : 'text-gray-800'}`}>
                {p.paid_at ? '✓ Paid' : formatPeso(p.amount_due)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BorrowerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading } = useLoansByBorrower(id)

  const borrower = borrowers.find((b) => b.id === id)

  if (!borrower) return (
    <PageWrapper title="Borrower">
      <p className="text-center text-gray-400 py-8">Borrower not found.</p>
    </PageWrapper>
  )

  return (
    <PageWrapper
      title={borrower.name}
      action={
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
      }
    >
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone size={15} className="text-gray-400" />
          {borrower.mobile}
        </div>
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin size={15} className="text-gray-400 mt-0.5 shrink-0" />
          {borrower.address}
        </div>
        {borrower.facebook && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link size={15} className="text-gray-400" />
            {borrower.facebook}
          </div>
        )}
        {borrower.guarantor && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Shield size={15} className="text-gray-400" />
            Guarantor: {borrower.guarantor}
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Loan History
      </h2>

      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : loans.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No loans on record.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {loans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
        </div>
      )}
    </PageWrapper>
  )
}

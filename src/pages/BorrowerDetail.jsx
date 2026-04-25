import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Link, Shield, Pencil } from 'lucide-react'
import { format } from 'date-fns'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useBorrowers } from '@/hooks/useBorrowers'
import { useLoansByBorrower, useEditLoan, useEditPayment } from '@/hooks/useLoans'
import { useToast } from '@/components/ui/Toast'
import { formatPeso } from '@/lib/loanUtils'

const collectionBadge = {
  complete:      'bg-green-100 text-green-700',
  interest_only: 'bg-blue-100 text-blue-700',
  partial:       'bg-orange-100 text-orange-700',
}
const collectionLabel = {
  complete:      'Complete',
  interest_only: 'Interest Only',
  partial:       'Partial',
}

function EditLoanModal({ loan, onClose }) {
  const toast = useToast()
  const editLoan = useEditLoan()
  const [form, setForm] = useState({
    principal: loan.principal,
    interest_rate: loan.interest_rate,
    loan_date: loan.loan_date,
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      await editLoan.mutateAsync({
        id: loan.id,
        principal: parseFloat(form.principal),
        interest_rate: parseFloat(form.interest_rate),
        loan_date: form.loan_date,
        type: loan.type,
      })
      toast({ message: 'Loan updated', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to update loan', type: 'error' })
    }
  }

  const newTotal = parseFloat(form.principal) * (1 + parseFloat(form.interest_rate) / 100)

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Principal Amount (PHP)"
        type="number"
        min="1"
        step="0.01"
        value={form.principal}
        onChange={set('principal')}
      />
      {loan.type === 'monthly' ? (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Interest Rate</label>
          <div className="flex gap-2">
            {[10, 15, 20].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setForm((f) => ({ ...f, interest_rate: r }))}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  Number(form.interest_rate) === r
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {r}%
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Interest Rate</label>
          <div className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-500">20% (fixed for weekly)</div>
        </div>
      )}
      <Input
        label="Loan Date"
        type="date"
        value={form.loan_date}
        onChange={set('loan_date')}
      />
      {!isNaN(newTotal) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm flex justify-between">
          <span className="text-gray-600">New Total Due</span>
          <span className="font-bold text-blue-700">{formatPeso(newTotal)}</span>
        </div>
      )}
      <Button type="submit" size="full" disabled={editLoan.isPending}>
        {editLoan.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}

function EditPaymentModal({ payment, loan, onClose }) {
  const toast = useToast()
  const editPayment = useEditPayment()
  const [amountDue, setAmountDue] = useState(payment.amount_due)
  const [amountPaid, setAmountPaid] = useState(payment.amount_paid ?? '')
  const [dueDate, setDueDate] = useState(payment.due_date)

  const principal = Number(loan.principal)
  const rate = Number(loan.interest_rate)
  const interest = principal * (rate / 100)

  const inferType = (paid, due) => {
    const p = Number(paid), d = Number(due)
    if (!p) return null
    if (Math.abs(p - d) < 0.01) return 'complete'
    if (Math.abs(p - interest) < 0.01) return 'interest_only'
    return 'partial'
  }

  const inferredType = payment.paid_at ? inferType(amountPaid, amountDue) : null

  const submit = async (e) => {
    e.preventDefault()
    try {
      await editPayment.mutateAsync({
        id: payment.id,
        amount_due: parseFloat(amountDue),
        amount_paid: payment.paid_at ? parseFloat(amountPaid) : undefined,
        due_date: dueDate,
        loan,
        week_number: payment.week_number,
      })
      toast({ message: 'Payment updated', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to update payment', type: 'error' })
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Amount Due (PHP)"
        type="number"
        min="1"
        step="0.01"
        value={amountDue}
        onChange={(e) => setAmountDue(e.target.value)}
      />
      <Input
        label="Due Date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      {payment.paid_at && (
        <div className="flex flex-col gap-1">
          <Input
            label="Amount Paid (PHP)"
            type="number"
            min="1"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
          {inferredType && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">Collection type will be:</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${collectionBadge[inferredType]}`}>
                {collectionLabel[inferredType]}
              </span>
            </div>
          )}
        </div>
      )}
      <Button type="submit" size="full" disabled={editPayment.isPending}>
        {editPayment.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}

function LoanCard({ loan }) {
  const [editLoan, setEditLoan] = useState(false)
  const [editPayment, setEditPayment] = useState(null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      {/* Loan header */}
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
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {loan.status}
          </span>
          <button
            onClick={() => setEditLoan(true)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"
            title="Edit loan"
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 flex gap-3">
        <span>Loan date: {format(new Date(loan.loan_date), 'MMM d, yyyy')}</span>
        <span>Interest: {loan.interest_rate}%</span>
      </div>

      {/* Payment trail */}
      {loan.payments && loan.payments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Payments</p>
          {loan.payments.map((p) => (
            <div key={p.id} className={`flex flex-col gap-1 text-sm py-2 px-3 rounded-lg ${
              p.paid_at ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {loan.type === 'weekly' ? `Week ${p.week_number}` : `Payment #${p.week_number}`}
                  {' — '}
                  {p.paid_at
                    ? format(new Date(p.paid_at), 'MMM d, yyyy h:mm a')
                    : `Due ${format(new Date(p.due_date), 'MMM d, yyyy')}`}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${p.paid_at ? 'text-green-600' : 'text-gray-800'}`}>
                    {p.paid_at ? formatPeso(p.amount_paid ?? p.amount_due) : formatPeso(p.amount_due)}
                  </span>
                  <button
                    onClick={() => setEditPayment(p)}
                    className="p-1 rounded-full hover:bg-white text-gray-400 hover:text-gray-700"
                    title="Edit payment"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>

              {/* Collection type badge */}
              {p.paid_at && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    collectionBadge[p.collection_type] || collectionBadge.complete
                  }`}>
                    {collectionLabel[p.collection_type] || 'Complete'}
                  </span>
                  {p.note && (
                    <span className="text-xs text-gray-500 italic">"{p.note}"</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Loan Modal */}
      <Modal open={editLoan} onClose={() => setEditLoan(false)} title="Edit Loan">
        <EditLoanModal loan={loan} onClose={() => setEditLoan(false)} />
      </Modal>

      {/* Edit Payment Modal */}
      <Modal open={!!editPayment} onClose={() => setEditPayment(null)} title="Edit Payment">
        {editPayment && (
          <EditPaymentModal
            payment={editPayment}
            loan={loan}
            onClose={() => setEditPayment(null)}
          />
        )}
      </Modal>
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

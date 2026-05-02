import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Link, Shield, Pencil, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useBorrowers, useEditBorrower } from '@/hooks/useBorrowers'
import { useLoansByBorrower, useEditLoan, useEditPayment, useDeleteLoan, useRenewLoan } from '@/hooks/useLoans'
import { useSettleLoansByBorrower, useDeleteSettleLoan, useDeleteSettlePayment, useEditSettleLoan, useEditSettlePayment } from '@/hooks/useSettle'
import { useCollectLapseFee } from '@/hooks/usePayments'
import { useToast } from '@/components/ui/Toast'
import { formatPeso } from '@/lib/loanUtils'

const collectionBadge = {
  complete:      'bg-green-100 text-green-700',
  interest_only: 'bg-blue-100 text-blue-700',
  partial:       'bg-orange-100 text-orange-700',
  lapsed:        'bg-red-100 text-red-700',
}
const collectionLabel = {
  complete:      'Complete',
  interest_only: 'Interest Only',
  partial:       'Partial',
  lapsed:        'Lapsed',
}

function EditBorrowerModal({ borrower, onClose }) {
  const toast = useToast()
  const editBorrower = useEditBorrower()
  const [form, setForm] = useState({
    name: borrower.name,
    mobile: borrower.mobile,
    address: borrower.address,
    facebook: borrower.facebook || '',
    guarantor: borrower.guarantor || '',
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    try {
      await editBorrower.mutateAsync({ id: borrower.id, ...form })
      toast({ message: 'Borrower updated', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to update borrower', type: 'error' })
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Full Name *" value={form.name} onChange={set('name')} />
      <Input label="Mobile Number *" value={form.mobile} onChange={set('mobile')} />
      <Input label="Address *" value={form.address} onChange={set('address')} />
      <Input label="Facebook" value={form.facebook} onChange={set('facebook')} />
      <Input label="Guarantor" value={form.guarantor} onChange={set('guarantor')} />
      <Button type="submit" size="full" disabled={editBorrower.isPending}>
        {editBorrower.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
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
  const [note, setNote] = useState(payment.note || '')

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
        note: note || null,
        loan,
        week_number: payment.week_number,
      })
      toast({ message: 'Payment updated', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to update payment', type: 'error' })
    }
  }

  const isWeekly = loan.type === 'weekly'

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!isWeekly && (
        <Input
          label="Amount Due (PHP)"
          type="number"
          min="1"
          step="0.01"
          value={amountDue}
          onChange={(e) => setAmountDue(e.target.value)}
        />
      )}
      <Input
        label="Due Date"
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      {payment.paid_at && !isWeekly && (
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Paid at home..."
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <Button type="submit" size="full" disabled={editPayment.isPending}>
        {editPayment.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}

function RenewLoanModal({ loan, onClose }) {
  const toast = useToast()
  const renewLoan = useRenewLoan()
  const [newPrincipal, setNewPrincipal] = useState(String(loan.principal))

  const submit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(newPrincipal)
    if (!amt || amt <= 0) return
    try {
      await renewLoan.mutateAsync({
        loanId: loan.id,
        newPrincipal: amt,
        oldPrincipal: Number(loan.principal),
        interestRate: Number(loan.interest_rate),
      })
      toast({ message: 'Loan renewed!', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to renew loan', type: 'error' })
    }
  }

  const oldInterest = Number(loan.principal) * (Number(loan.interest_rate) / 100)
  const newTotal = parseFloat(newPrincipal) * 1.20
  const newWeekly = newTotal / 6

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm flex flex-col gap-1.5">
        <p className="font-semibold text-purple-700 mb-0.5">What happens on renewal:</p>
        <p className="text-purple-600">• Remaining unpaid weeks are wiped</p>
        <p className="text-purple-600">• <span className="font-medium">{formatPeso(oldInterest)}</span> interest booked as profit</p>
        <p className="text-purple-600">• 6 new weekly payments generated from today</p>
      </div>

      <Input
        label="New Capital (PHP)"
        type="number"
        min="1"
        step="0.01"
        value={newPrincipal}
        onChange={(e) => setNewPrincipal(e.target.value)}
      />

      {!isNaN(newTotal) && parseFloat(newPrincipal) > 0 && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Due (20%)</span>
            <span className="font-semibold text-gray-900">{formatPeso(newTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Weekly Payment</span>
            <span className="font-semibold text-gray-900">{formatPeso(newWeekly)}</span>
          </div>
        </div>
      )}

      <Button type="submit" size="full" disabled={renewLoan.isPending}>
        {renewLoan.isPending ? 'Renewing...' : 'Confirm Renewal'}
      </Button>
      <Button variant="ghost" size="full" type="button" onClick={onClose}>Cancel</Button>
    </form>
  )
}

function LoanCard({ loan }) {
  const toast = useToast()
  const collectLapseFee = useCollectLapseFee()
  const deleteLoan = useDeleteLoan()
  const [expanded, setExpanded] = useState(false)
  const [editLoan, setEditLoan] = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [collectingLapseFee, setCollectingLapseFee] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renewing, setRenewing] = useState(false)

  const paidPayments = loan.payments?.filter((p) => p.paid_at && !p.is_renewal_marker) || []
  const canRenew = loan.type === 'weekly' && loan.status === 'active' && paidPayments.length >= 1

  const handleCollectLapseFee = async () => {
    try {
      await collectLapseFee.mutateAsync({ paymentId: collectingLapseFee.id })
      toast({ message: 'Lapse fee collected!', type: 'success' })
      setCollectingLapseFee(null)
    } catch {
      toast({ message: 'Failed to collect lapse fee', type: 'error' })
    }
  }

  const handleDelete = async () => {
    try {
      await deleteLoan.mutateAsync(loan.id)
      toast({ message: 'Loan deleted', type: 'success' })
      setConfirmDelete(false)
    } catch (e) {
      if (e.message === 'has_payments') {
        toast({ message: 'Cannot delete — loan already has payments recorded.', type: 'error' })
      } else {
        toast({ message: 'Failed to delete loan', type: 'error' })
      }
      setConfirmDelete(false)
    }
  }

  const paidCount = paidPayments.length
  const totalCount = loan.payments?.filter((p) => !p.is_renewal_marker).length || 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              loan.type === 'weekly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {loan.type.charAt(0).toUpperCase() + loan.type.slice(1)}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {loan.status}
            </span>
          </div>
          <div className="flex items-baseline gap-3 mt-0.5">
            <span className="font-semibold text-gray-900">{formatPeso(loan.principal)}</span>
            <span className="text-xs text-gray-400">{loan.interest_rate}% interest</span>
            <span className="text-xs text-gray-400">{format(new Date(loan.loan_date), 'MMM d, yyyy')}</span>
          </div>
          {loan.type === 'weekly' && (
            <p className="text-xs text-gray-400">{paidCount} of {totalCount} payments collected</p>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100">
          <div className="flex items-center justify-between pt-3">
            <p className="text-sm text-gray-500">
              Total due: <span className="font-medium text-gray-700">{formatPeso(loan.total_due)}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center gap-1 text-xs"
                title="Delete loan"
              >
                <Trash2 size={13} /> Delete
              </button>
              {paidCount === 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditLoan(true) }}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center gap-1 text-xs"
                  title="Edit loan"
                >
                  <Pencil size={13} /> Edit loan
                </button>
              )}
              {canRenew && (
                <button
                  onClick={(e) => { e.stopPropagation(); setRenewing(true) }}
                  className="p-1.5 rounded-full hover:bg-purple-50 text-gray-400 hover:text-purple-600 flex items-center gap-1 text-xs"
                  title="Renew loan"
                >
                  <RefreshCw size={13} /> Renew
                </button>
              )}
            </div>
          </div>

          {/* Payment trail */}
          {loan.payments && loan.payments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Payments</p>
              {loan.payments.map((p) => {
                // Renewal marker — show as a special divider row
                if (p.is_renewal_marker) {
                  return (
                    <div key={p.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-purple-50 border border-purple-200">
                      <RefreshCw size={13} className="text-purple-500 shrink-0" />
                      <span className="text-sm font-semibold text-purple-700">Loan Renewed</span>
                      <span className="text-xs text-purple-500 ml-auto">{format(new Date(p.paid_at), 'MMM d, yyyy')}</span>
                    </div>
                  )
                }

                const isLapsed = p.collection_type === 'lapsed' && p.paid_at
                const isUnpaidLapseFee = p.is_lapse_fee && !p.paid_at
                const rowBg = p.paid_at && !isLapsed ? 'bg-green-50' : isLapsed ? 'bg-red-50' : isUnpaidLapseFee ? 'bg-yellow-50' : 'bg-gray-50'

                // For weekly loans, label relative to the last renewal marker
                let label
                if (p.is_lapse_fee) {
                  label = 'Unpaid Interest (Lapse)'
                } else if (loan.type === 'weekly') {
                  const renewalMarkers = loan.payments
                    .filter((r) => r.is_renewal_marker)
                    .sort((a, b) => a.week_number - b.week_number)
                  const renewalsBefore = renewalMarkers.filter((r) => r.week_number < p.week_number).length
                  if (renewalsBefore === 0) {
                    label = `Week ${p.week_number}`
                  } else {
                    const lastMarkerWeek = renewalMarkers[renewalsBefore - 1].week_number
                    label = `R${renewalsBefore}-Week ${p.week_number - lastMarkerWeek}`
                  }
                } else {
                  label = `Payment #${p.week_number}`
                }
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col gap-1 text-sm py-2 px-3 rounded-lg ${rowBg} ${isUnpaidLapseFee ? 'cursor-pointer hover:brightness-95' : ''}`}
                    onClick={isUnpaidLapseFee ? () => setCollectingLapseFee(p) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        {label}
                        {' — '}
                        {isLapsed
                          ? `Lapsed ${format(new Date(p.paid_at), 'MMM d, yyyy')}`
                          : p.paid_at
                          ? format(new Date(p.paid_at), 'MMM d, yyyy h:mm a')
                          : `Due ${format(new Date(p.due_date), 'MMM d, yyyy')}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${p.paid_at && !isLapsed ? 'text-green-600' : isLapsed ? 'text-red-500' : isUnpaidLapseFee ? 'text-yellow-700' : 'text-gray-800'}`}>
                          {p.paid_at && p.amount_paid != null ? formatPeso(p.amount_paid) : formatPeso(p.amount_due)}
                        </span>
                        {p.paid_at && !isUnpaidLapseFee && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditPayment(p) }}
                            className="p-1 rounded-full hover:bg-white text-gray-400 hover:text-gray-700"
                            title="Edit payment"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isLapsed && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Lapsed</span>
                      )}
                      {isUnpaidLapseFee && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Tap to collect</span>
                      )}
                      {p.paid_at && !isLapsed && !p.is_lapse_fee && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${collectionBadge[p.collection_type] || collectionBadge.complete}`}>
                          {collectionLabel[p.collection_type] || 'Complete'}
                        </span>
                      )}
                      {p.paid_at && p.is_lapse_fee && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Interest Collected</span>
                      )}
                      {p.note && (
                        <span className="text-xs text-gray-500 italic">"{p.note}"</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Collect Lapse Fee Modal */}
      <Modal open={!!collectingLapseFee} onClose={() => setCollectingLapseFee(null)} title="Collect Lapse Interest">
        {collectingLapseFee && (
          <div className="flex flex-col gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-900">{formatPeso(collectingLapseFee.amount_due)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-yellow-700">Unpaid Lapse Interest</span>
              </div>
            </div>
            <p className="text-sm text-center text-gray-500">Confirm collection of lapse interest?</p>
            <div className="flex gap-3">
              <Button variant="outline" size="full" onClick={() => setCollectingLapseFee(null)}>Cancel</Button>
              <Button size="full" onClick={handleCollectLapseFee} disabled={collectLapseFee.isPending}>
                {collectLapseFee.isPending ? 'Collecting...' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Loan Confirm */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Loan">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 text-center">
            Delete this <span className="font-semibold">{loan.type}</span> loan of <span className="font-semibold">{formatPeso(loan.principal)}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="full" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button size="full" onClick={handleDelete} disabled={deleteLoan.isPending}
              className="bg-red-500 hover:bg-red-600 text-white">
              {deleteLoan.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Loan Modal */}
      <Modal open={editLoan} onClose={() => setEditLoan(false)} title="Edit Loan">
        <EditLoanModal loan={loan} onClose={() => setEditLoan(false)} />
      </Modal>

      {/* Renew Loan Modal */}
      <Modal open={renewing} onClose={() => setRenewing(false)} title="Renew Loan">
        <RenewLoanModal loan={loan} onClose={() => setRenewing(false)} />
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

function SettleLoanCard({ loan }) {
  const toast = useToast()
  const deleteLoan = useDeleteSettleLoan()
  const deletePayment = useDeleteSettlePayment()
  const editLoanMut = useEditSettleLoan()
  const editPaymentMut = useEditSettlePayment()
  const [expanded, setExpanded] = useState(false)
  const [confirmDeleteLoan, setConfirmDeleteLoan] = useState(false)
  const [confirmDeletePayment, setConfirmDeletePayment] = useState(null)
  const [editingLoan, setEditingLoan] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)

  // Edit loan form state
  const [loanPrincipal, setLoanPrincipal] = useState(String(loan.principal))
  const [loanDate, setLoanDate] = useState(loan.loan_date)

  // Edit payment form state
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payDate, setPayDate] = useState('')

  const payments = loan.payments || []
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const principal = Number(loan.principal)
  const remaining = Math.max(0, principal - totalPaid)
  const pct = Math.min(100, (totalPaid / principal) * 100)

  const openEditPayment = (p) => {
    setPayAmount(String(p.amount))
    setPayNote(p.note || '')
    setPayDate(p.paid_at ? p.paid_at.slice(0, 10) : '')
    setEditingPayment(p)
  }

  const handleDeleteLoan = async () => {
    try {
      await deleteLoan.mutateAsync(loan.id)
      toast({ message: 'Loan deleted', type: 'success' })
      setConfirmDeleteLoan(false)
    } catch (e) {
      toast({ message: e.message === 'has_payments' ? 'Cannot delete — loan has payments recorded.' : 'Failed to delete loan', type: 'error' })
      setConfirmDeleteLoan(false)
    }
  }

  const handleDeletePayment = async () => {
    const p = confirmDeletePayment
    try {
      await deletePayment.mutateAsync({
        paymentId: p.id,
        loanId: loan.id,
        paymentAmount: Number(p.amount),
        totalPaid,
        principal,
      })
      toast({ message: 'Payment deleted', type: 'success' })
      setConfirmDeletePayment(null)
    } catch {
      toast({ message: 'Failed to delete payment', type: 'error' })
      setConfirmDeletePayment(null)
    }
  }

  const handleEditLoan = async (e) => {
    e.preventDefault()
    try {
      await editLoanMut.mutateAsync({ id: loan.id, principal: parseFloat(loanPrincipal), loan_date: loanDate })
      toast({ message: 'Loan updated', type: 'success' })
      setEditingLoan(false)
    } catch {
      toast({ message: 'Failed to update loan', type: 'error' })
    }
  }

  const handleEditPayment = async (e) => {
    e.preventDefault()
    const newAmt = parseFloat(payAmount)
    if (!newAmt || newAmt <= 0) return
    try {
      await editPaymentMut.mutateAsync({
        id: editingPayment.id,
        loanId: loan.id,
        oldAmount: Number(editingPayment.amount),
        newAmount: newAmt,
        newNote: payNote,
        newDate: payDate || null,
        principal,
        totalPaid,
      })
      toast({ message: 'Payment updated', type: 'success' })
      setEditingPayment(null)
    } catch {
      toast({ message: 'Failed to update payment', type: 'error' })
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">To Settle</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {loan.status}
            </span>
          </div>
          <div className="flex items-baseline gap-3 mt-0.5">
            <span className="font-semibold text-gray-900">{formatPeso(principal)}</span>
            <span className="text-xs text-gray-400">No interest</span>
            <span className="text-xs text-gray-400">{format(new Date(loan.loan_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5">
            <div className="bg-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400">{formatPeso(totalPaid)} paid · {formatPeso(remaining)} remaining</p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100">
          <div className="flex items-center justify-end gap-1 pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); setLoanPrincipal(String(loan.principal)); setLoanDate(loan.loan_date); setEditingLoan(true) }}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center gap-1 text-xs"
            >
              <Pencil size={13} /> Edit loan
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteLoan(true) }}
              className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center gap-1 text-xs"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>

          {payments.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Payment History</p>
              {[...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).map((p) => (
                <div key={p.id} className="bg-teal-50 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-600">{format(new Date(p.paid_at), 'MMM d, yyyy h:mm a')}</span>
                    {p.note && <p className="text-xs text-gray-400 italic">"{p.note}"</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-teal-700">{formatPeso(p.amount)}</span>
                    <button
                      onClick={() => openEditPayment(p)}
                      className="text-gray-300 hover:text-gray-600 transition-colors p-1 rounded"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeletePayment(p)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">No payments yet</p>
          )}
        </div>
      )}

      {/* Edit Loan Modal */}
      <Modal open={editingLoan} onClose={() => setEditingLoan(false)} title="Edit Loan">
        <form onSubmit={handleEditLoan} className="flex flex-col gap-4">
          <Input
            label="Loan Amount (PHP)"
            type="number"
            min="1"
            step="0.01"
            value={loanPrincipal}
            onChange={(e) => setLoanPrincipal(e.target.value)}
          />
          <Input
            label="Loan Date"
            type="date"
            value={loanDate}
            onChange={(e) => setLoanDate(e.target.value)}
          />
          <Button type="submit" size="full" disabled={editLoanMut.isPending}>
            {editLoanMut.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal open={!!editingPayment} onClose={() => setEditingPayment(null)} title="Edit Payment">
        {editingPayment && (
          <form onSubmit={handleEditPayment} className="flex flex-col gap-4">
            <Input
              label="Amount (PHP)"
              type="number"
              min="0.01"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
            <Button type="submit" size="full" disabled={editPaymentMut.isPending}>
              {editPaymentMut.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        )}
      </Modal>

      {/* Delete Loan Confirm */}
      <Modal open={confirmDeleteLoan} onClose={() => setConfirmDeleteLoan(false)} title="Delete Loan">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 text-center">
            Delete this To Settle loan of <span className="font-semibold">{formatPeso(principal)}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="full" onClick={() => setConfirmDeleteLoan(false)}>Cancel</Button>
            <Button size="full" onClick={handleDeleteLoan} disabled={deleteLoan.isPending}
              className="bg-red-500 hover:bg-red-600 text-white">
              {deleteLoan.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Payment Confirm */}
      <Modal open={!!confirmDeletePayment} onClose={() => setConfirmDeletePayment(null)} title="Delete Payment">
        {confirmDeletePayment && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 text-center">
              Delete this payment of <span className="font-semibold">{formatPeso(confirmDeletePayment.amount)}</span>?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="full" onClick={() => setConfirmDeletePayment(null)}>Cancel</Button>
              <Button size="full" onClick={handleDeletePayment} disabled={deletePayment.isPending}
                className="bg-red-500 hover:bg-red-600 text-white">
                {deletePayment.isPending ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function BorrowerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: borrowers = [] } = useBorrowers()
  const { data: loans = [], isLoading: loansLoading } = useLoansByBorrower(id)
  const { data: settleLoans = [], isLoading: settleLoading } = useSettleLoansByBorrower(id)
  const [editBorrower, setEditBorrower] = useState(false)
  const [filter, setFilter] = useState('all')

  const borrower = borrowers.find((b) => b.id === id)

  // Build dynamic filter tabs — only show types that exist
  const hasMonthly = loans.some((l) => l.type === 'monthly')
  const hasWeekly = loans.some((l) => l.type === 'weekly')
  const hasSettle = settleLoans.length > 0
  const tabs = [
    'all',
    ...(hasMonthly ? ['monthly'] : []),
    ...(hasWeekly ? ['weekly'] : []),
    ...(hasSettle ? ['settle'] : []),
  ]

  const isLoading = loansLoading || settleLoading
  const hasAny = loans.length > 0 || settleLoans.length > 0

  const showLoans = filter === 'all' || filter === 'monthly' || filter === 'weekly'
    ? loans.filter((l) => filter === 'all' || l.type === filter)
    : []
  const showSettle = filter === 'all' || filter === 'settle' ? settleLoans : []

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
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
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
          <button
            onClick={() => setEditBorrower(true)}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"
            title="Edit borrower"
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
        Loan History
      </h2>

      {/* Dynamic filter tabs */}
      {!isLoading && hasAny && tabs.length > 1 && (
        <div className="flex gap-2 mb-3">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t === 'settle' ? 'To Settle' : t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : !hasAny ? (
        <p className="text-center text-gray-400 py-8">No loans on record.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {showLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
          {showSettle.map((loan) => <SettleLoanCard key={loan.id} loan={loan} />)}
        </div>
      )}

      <Modal open={editBorrower} onClose={() => setEditBorrower(false)} title="Edit Borrower">
        <EditBorrowerModal borrower={borrower} onClose={() => setEditBorrower(false)} />
      </Modal>
    </PageWrapper>
  )
}

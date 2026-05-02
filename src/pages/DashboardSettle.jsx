import { useState } from 'react'
import { format } from 'date-fns'
import { Banknote, ClipboardList, ChevronDown, ChevronUp, Trash2, Pencil } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FAB from '@/components/layout/FAB'
import { useSettleLoans, useCollectSettlePayment, useDeleteSettleLoan, useDeleteSettlePayment, useEditSettleLoan, useEditSettlePayment } from '@/hooks/useSettle'
import { useToast } from '@/components/ui/Toast'
import { formatPeso } from '@/lib/loanUtils'

function ProgressBar({ totalPaid, principal }) {
  const pct = Math.min(100, (totalPaid / principal) * 100)
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-teal-500 h-2 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function CollectModal({ loan, onClose }) {
  const toast = useToast()
  const collect = useCollectSettlePayment()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const totalPaid = (loan.payments || []).reduce((s, p) => s + Number(p.amount), 0)
  const remaining = Number(loan.principal) - totalPaid

  const submit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    try {
      await collect.mutateAsync({
        loanId: loan.id,
        principal: Number(loan.principal),
        totalPaid,
        amount: amt,
        note,
      })
      toast({ message: 'Payment recorded!', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to record payment', type: 'error' })
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Borrower</span>
          <span className="font-medium text-gray-900">{loan.borrower?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total Loan</span>
          <span className="font-medium text-gray-900">{formatPeso(loan.principal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Paid so far</span>
          <span className="font-medium text-teal-600">{formatPeso(totalPaid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Remaining</span>
          <span className="font-semibold text-gray-900">{formatPeso(remaining)}</span>
        </div>
        <ProgressBar totalPaid={totalPaid} principal={Number(loan.principal)} />
      </div>

      <Input
        label="Amount Collected (PHP)"
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g. 500"
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Paid at home..."
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
      </div>
      <Button type="submit" size="full" disabled={collect.isPending}>
        {collect.isPending ? 'Recording...' : 'Confirm Collection'}
      </Button>
      <Button variant="ghost" size="full" onClick={onClose} type="button">Cancel</Button>
    </form>
  )
}

function PaymentRow({ payment, loan, totalPaid }) {
  const toast = useToast()
  const deletePayment = useDeleteSettlePayment()
  const editPayment = useEditSettlePayment()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editAmount, setEditAmount] = useState(String(payment.amount))
  const [editNote, setEditNote] = useState(payment.note || '')
  const [editDate, setEditDate] = useState(payment.paid_at ? payment.paid_at.slice(0, 10) : '')

  const handleDelete = async () => {
    try {
      await deletePayment.mutateAsync({
        paymentId: payment.id,
        loanId: loan.id,
        paymentAmount: Number(payment.amount),
        totalPaid,
        principal: Number(loan.principal),
      })
      toast({ message: 'Payment deleted', type: 'success' })
      setConfirmDelete(false)
    } catch {
      toast({ message: 'Failed to delete payment', type: 'error' })
      setConfirmDelete(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    const newAmt = parseFloat(editAmount)
    if (!newAmt || newAmt <= 0) return
    try {
      await editPayment.mutateAsync({
        id: payment.id,
        loanId: loan.id,
        oldAmount: Number(payment.amount),
        newAmount: newAmt,
        newNote: editNote,
        newDate: editDate || null,
        principal: Number(loan.principal),
        totalPaid,
      })
      toast({ message: 'Payment updated', type: 'success' })
      setEditing(false)
    } catch {
      toast({ message: 'Failed to update payment', type: 'error' })
    }
  }

  return (
    <>
      <div className="bg-teal-50 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
        <div>
          <span className="text-gray-600">{format(new Date(payment.paid_at), 'MMM d, yyyy h:mm a')}</span>
          {payment.note && <p className="text-xs text-gray-400 italic">"{payment.note}"</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-teal-700">{formatPeso(payment.amount)}</span>
          <button
            onClick={() => { setEditAmount(String(payment.amount)); setEditNote(payment.note || ''); setEditDate(payment.paid_at ? payment.paid_at.slice(0, 10) : ''); setEditing(true) }}
            className="text-gray-300 hover:text-gray-600 transition-colors p-1 rounded"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Payment">
        <form onSubmit={handleEdit} className="flex flex-col gap-4">
          <Input
            label="Amount (PHP)"
            type="number"
            min="0.01"
            step="0.01"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
          <Button type="submit" size="full" disabled={editPayment.isPending}>
            {editPayment.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Payment">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 text-center">
            Delete this payment of <span className="font-semibold">{formatPeso(payment.amount)}</span>? The progress bar and dashboard will update.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="full" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              size="full"
              onClick={handleDelete}
              disabled={deletePayment.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deletePayment.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function LoanItem({ loan }) {
  const toast = useToast()
  const deleteLoan = useDeleteSettleLoan()
  const editLoan = useEditSettleLoan()
  const [expanded, setExpanded] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingLoan, setEditingLoan] = useState(false)
  const [loanPrincipal, setLoanPrincipal] = useState(String(loan.principal))
  const [loanDate, setLoanDate] = useState(loan.loan_date)

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

  const handleEditLoan = async (e) => {
    e.preventDefault()
    try {
      await editLoan.mutateAsync({ id: loan.id, principal: parseFloat(loanPrincipal), loan_date: loanDate })
      toast({ message: 'Loan updated', type: 'success' })
      setEditingLoan(false)
    } catch {
      toast({ message: 'Failed to update loan', type: 'error' })
    }
  }

  const payments = loan.payments || []
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const principal = Number(loan.principal)
  const remaining = principal - totalPaid
  const isActive = loan.status === 'active'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{loan.borrower?.name}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isActive ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {isActive ? 'Active' : 'Completed'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">{formatPeso(totalPaid)} / {formatPeso(principal)}</span>
            <span className="text-gray-400 text-xs">{format(new Date(loan.loan_date), 'MMM d, yyyy')}</span>
          </div>
          <ProgressBar totalPaid={totalPaid} principal={principal} />
        </div>
        <div className="flex flex-col items-end gap-2 ml-2">
          <div className="flex flex-col items-end gap-1">
            {isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); setCollecting(true) }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
              >
                Collect
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setLoanPrincipal(String(loan.principal)); setLoanDate(loan.loan_date); setEditingLoan(true) }}
              className="text-xs font-medium px-2 py-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              className="text-xs font-medium px-2 py-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
          {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="flex justify-between text-sm py-3 text-gray-500">
            <span>Remaining</span>
            <span className="font-semibold text-gray-900">{formatPeso(Math.max(0, remaining))}</span>
          </div>
          {payments.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Payment History</p>
              {[...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).map((p) => (
                <PaymentRow key={p.id} payment={p} loan={loan} totalPaid={totalPaid} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-2">No payments yet</p>
          )}
        </div>
      )}

      <Modal open={collecting} onClose={() => setCollecting(false)} title="Record Payment">
        <CollectModal loan={loan} onClose={() => setCollecting(false)} />
      </Modal>

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
          <Button type="submit" size="full" disabled={editLoan.isPending}>
            {editLoan.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Loan">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 text-center">
            Delete this loan of <span className="font-semibold">{formatPeso(loan.principal)}</span> for <span className="font-semibold">{loan.borrower?.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="full" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              size="full"
              onClick={handleDelete}
              disabled={deleteLoan.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteLoan.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function DashboardSettle() {
  const { data: loans = [], isLoading } = useSettleLoans()
  const [tab, setTab] = useState('active')

  const activeLoans = loans.filter((l) => l.status === 'active')
  const totalLent = activeLoans.reduce((s, l) => {
    const paid = (l.payments || []).reduce((ps, p) => ps + Number(p.amount), 0)
    return s + Math.max(0, Number(l.principal) - paid)
  }, 0)
  const activeCount = activeLoans.length
  const filteredLoans = loans.filter((l) => l.status === (tab === 'active' ? 'active' : 'completed'))

  return (
    <PageWrapper title="To Settle">
      {/* Header banner */}
      <div className="rounded-2xl p-4 mb-5 text-white bg-gradient-to-r from-teal-600 to-teal-400">
        <p className="text-sm font-medium opacity-80 mb-1">No-Interest Loans</p>
        <p className="text-3xl font-bold">{formatPeso(totalLent)}</p>
        <p className="text-xs opacity-70 mt-1">Total capital lent out</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex flex-col gap-3">
          <div className="bg-teal-500 p-2 rounded-xl w-fit">
            <Banknote size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Total Lent</p>
            <p className="text-xl font-bold text-teal-600">{isLoading ? '...' : formatPeso(totalLent)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Active capital</p>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex flex-col gap-3">
          <div className="bg-purple-500 p-2 rounded-xl w-fit">
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Active Loans</p>
            <p className="text-xl font-bold text-purple-600">{isLoading ? '...' : activeCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Ongoing</p>
          </div>
        </div>
      </div>

      {/* Loan list */}
      <div className="flex gap-2 mb-3">
        {['active', 'completed'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : filteredLoans.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No {tab} loans.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLoans.map((loan) => <LoanItem key={loan.id} loan={loan} />)}
        </div>
      )}

      <FAB />
    </PageWrapper>
  )
}

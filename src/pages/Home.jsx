import { useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { CheckCircle, Download, ChevronDown, ChevronUp } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import FAB from '@/components/layout/FAB'
import { useUpcomingPayments, useMarkPaid } from '@/hooks/usePayments'
import { useRenewLoan } from '@/hooks/useLoans'
import { useToast } from '@/components/ui/Toast'
import { formatPeso, formatDate, formatDateTime, parseLocalDate } from '@/lib/loanUtils'
import { useInstallPrompt } from '@/lib/useInstallPrompt'
import { cn } from '@/lib/utils'

function getDayDiff(dueDateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseLocalDate(dueDateStr)
  due.setHours(0, 0, 0, 0)
  return differenceInCalendarDays(due, today)
}

function getChipStyle(diff) {
  if (diff < 0) return { bg: 'bg-red-50 border-red-200', badge: 'bg-red-500 text-white', label: 'Overdue' }
  if (diff === 0) return { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500 text-white', label: 'Today' }
  if (diff === 1) return { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-400 text-gray-900', label: 'Tomorrow' }
  return { bg: 'bg-green-50 border-green-200', badge: 'bg-green-400 text-white', label: 'In 2 days' }
}

function PaymentItem({ payment, onPay }) {
  const diff = getDayDiff(payment.due_date)
  const { bg, badge, label } = getChipStyle(diff)

  return (
    <div
      className={cn('rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform', bg)}
      onClick={() => onPay(payment)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900">{payment.loan?.borrower?.name}</span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', badge)}>{label}</span>
        </div>
        <p className="text-sm text-gray-500">
          {payment.loan?.type === 'weekly' ? `Week ${payment.week_number}` : 'Monthly payment'} &nbsp;·&nbsp; {formatDate(payment.due_date)}
        </p>
        <p className="text-sm text-gray-400">{payment.loan?.borrower?.mobile}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900">{formatPeso(payment.amount_due)}</p>
        <p className="text-xs text-gray-400 capitalize">{payment.loan?.type}</p>
      </div>
    </div>
  )
}

const confirmLabels = {
  complete:      { title: 'Complete Collection', color: 'text-green-700',  bg: 'bg-green-50 border-green-200'  },
  interest_only: { title: 'Interest Only',       color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'   },
  partial:       { title: 'Partial Collection',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  lapsed:        { title: 'Lapse',               color: 'text-red-700',    bg: 'bg-red-50 border-red-200'      },
}

function CollectionModal({ selected, payments, onClose, markPaid }) {
  const toast = useToast()
  const renewLoan = useRenewLoan()
  const [step, setStep] = useState('choose') // 'choose' | 'partial' | 'renew' | 'confirm'
  const [partialAmount, setPartialAmount] = useState('')
  const [renewPrincipal, setRenewPrincipal] = useState('')
  const [note, setNote] = useState('')
  const [pendingType, setPendingType] = useState(null)

  if (!selected) return null

  const loan = selected.loan
  const isMonthly = loan?.type === 'monthly'
  const isWeekly = loan?.type === 'weekly'
  const rate = Number(loan?.interest_rate || 0)
  const amountDue = Number(selected.amount_due)
  // Derive interest from amount_due so rollovers use their own capital, not the original principal
  const interest = amountDue * (rate / 100) / (1 + rate / 100)
  const effectiveCapital = amountDue - interest
  // Renew only available for weekly loans where at least 1 prior payment exists (week_number > 1)
  const canRenew = isWeekly && selected.week_number > 1

  const requestConfirm = (collectionType) => {
    if (collectionType === 'partial') {
      const partial = parseFloat(partialAmount)
      if (!partial || partial <= 0 || partial >= amountDue) {
        toast({ message: `Enter an amount between ₱1 and ${formatPeso(amountDue - 1)}`, type: 'error' })
        return
      }
    }
    setPendingType(collectionType)
    setStep('confirm')
  }

  const handleRenew = async () => {
    const amt = parseFloat(renewPrincipal)
    if (!amt || amt <= 0) return
    try {
      await renewLoan.mutateAsync({
        loanId: selected.loan_id,
        newPrincipal: amt,
        oldPrincipal: effectiveCapital,
        interestRate: rate,
      })
      toast({ message: 'Loan renewed!', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to renew loan', type: 'error' })
    }
  }

  const handleCollect = async () => {
    const collectionType = pendingType
    let amountPaid, rolloverAmount

    if (collectionType === 'complete') {
      amountPaid = amountDue
      rolloverAmount = null
    } else if (collectionType === 'interest_only') {
      amountPaid = interest
      rolloverAmount = effectiveCapital
    } else if (collectionType === 'partial') {
      amountPaid = parseFloat(partialAmount)
      rolloverAmount = amountDue - amountPaid
    }
    // lapsed: no amountPaid needed, handled entirely in useMarkPaid

    try {
      await markPaid.mutateAsync({
        paymentId: selected.id,
        loanId: selected.loan_id,
        collectionType,
        amountPaid,
        rolloverAmount,
        interestRate: rate,
        principal: effectiveCapital,
        note,
        dueDate: selected.due_date,
      })
      toast({ message: 'Payment recorded!', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to record payment', type: 'error' })
    }
  }

  return (
    <>
      {/* Summary card always visible */}
      <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Borrower</span>
          <span className="font-medium text-gray-900">{loan?.borrower?.name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Amount Due</span>
          <span className="font-semibold text-gray-900">{formatPeso(amountDue)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Due Date</span>
          <span className="text-gray-700">{formatDate(selected.due_date)}</span>
        </div>
        {isMonthly && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Capital</span>
              <span className="text-gray-700">{formatPeso(effectiveCapital)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Interest ({rate}%)</span>
              <span className="text-gray-700">{formatPeso(interest)}</span>
            </div>
          </>
        )}
      </div>

      {step === 'choose' && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => requestConfirm('complete')}
            className="w-full text-left rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 hover:border-green-400 transition-colors"
          >
            <p className="font-semibold text-green-700">
              {isWeekly ? `Collect Week ${selected.week_number}` : 'Complete Collection'}
            </p>
            <p className="text-sm text-green-600 mt-0.5">
              Collect full {formatPeso(amountDue)}{isWeekly ? '' : ' — loan cleared'}
            </p>
          </button>

          {canRenew && (
            <button
              onClick={() => { setRenewPrincipal(String(effectiveCapital)); setStep('renew') }}
              className="w-full text-left rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-3 hover:border-purple-400 transition-colors"
            >
              <p className="font-semibold text-purple-700">Renew Loan</p>
              <p className="text-sm text-purple-600 mt-0.5">
                Wipe remaining weeks — set new capital and restart 6 weeks from today
              </p>
            </button>
          )}

          {isMonthly && (
            <button
              onClick={() => requestConfirm('interest_only')}
              className="w-full text-left rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 hover:border-blue-400 transition-colors"
            >
              <p className="font-semibold text-blue-700">Interest Only</p>
              <p className="text-sm text-blue-600 mt-0.5">
                Collect {formatPeso(interest)} now — capital {formatPeso(effectiveCapital)} rolls over next month
              </p>
            </button>
          )}

          {isMonthly && (
            <button
              onClick={() => setStep('partial')}
              className="w-full text-left rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3 hover:border-orange-400 transition-colors"
            >
              <p className="font-semibold text-orange-700">Partial Collection</p>
              <p className="text-sm text-orange-600 mt-0.5">
                Collect a partial amount — balance + interest rolls over next month
              </p>
            </button>
          )}

          {isMonthly && (
            <button
              onClick={() => requestConfirm('lapsed')}
              className="w-full text-left rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 hover:border-red-400 transition-colors"
            >
              <p className="font-semibold text-red-700">Lapse</p>
              <p className="text-sm text-red-600 mt-0.5">
                Borrower failed to pay — interest {formatPeso(interest)} logged as debt, capital rolls over next month
              </p>
            </button>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid at home, borrower requested rollover..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <Button variant="ghost" size="full" onClick={onClose}>Cancel</Button>
        </div>
      )}

      {step === 'renew' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
            <p className="text-sm font-semibold text-purple-700 mb-1">Renew Loan</p>
            <p className="text-xs text-purple-600">
              Remaining unpaid weeks will be wiped. Full interest ({formatPeso(interest)}) booked as profit. 6 new weekly payments start from today.
            </p>
          </div>

          <Input
            label="New Capital (PHP)"
            type="number"
            min="1"
            step="0.01"
            value={renewPrincipal}
            onChange={(e) => setRenewPrincipal(e.target.value)}
          />

          {renewPrincipal && parseFloat(renewPrincipal) > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Due (20%)</span>
                <span className="font-semibold text-gray-900">{formatPeso(parseFloat(renewPrincipal) * 1.20)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Weekly Payment</span>
                <span className="font-semibold text-gray-900">{formatPeso(parseFloat(renewPrincipal) * 1.20 / 6)}</span>
              </div>
            </div>
          )}

          <Button size="full" onClick={handleRenew} disabled={renewLoan.isPending}>
            {renewLoan.isPending ? 'Renewing...' : 'Confirm Renewal'}
          </Button>
          <Button variant="ghost" size="full" onClick={() => setStep('choose')}>Back</Button>
        </div>
      )}

      {step === 'partial' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm font-semibold text-orange-700 mb-1">Partial Collection</p>
            <p className="text-xs text-orange-600">
              Enter how much was collected. The remaining balance will carry a {rate}% interest next month.
            </p>
          </div>

          <Input
            label="Amount Collected (PHP)"
            type="number"
            min="1"
            step="0.01"
            value={partialAmount}
            onChange={(e) => setPartialAmount(e.target.value)}
            placeholder="e.g. 7000"
          />

          {partialAmount && parseFloat(partialAmount) > 0 && parseFloat(partialAmount) < amountDue && (
            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Collected now</span>
                <span className="font-semibold text-gray-900">{formatPeso(parseFloat(partialAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining balance</span>
                <span className="font-medium text-gray-700">{formatPeso(amountDue - parseFloat(partialAmount))}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="text-gray-500">Due next month</span>
                <span className="font-bold text-orange-600">
                  {formatPeso((amountDue - parseFloat(partialAmount)) * (1 + rate / 100))}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Borrower paid what they could..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <Button size="full" onClick={() => requestConfirm('partial')}>
            Next: Confirm
          </Button>
          <Button variant="ghost" size="full" onClick={() => setStep('choose')}>Back</Button>
        </div>
      )}

      {step === 'confirm' && pendingType && (
        <div className="flex flex-col gap-4">
          <div className={`rounded-xl border-2 px-4 py-4 text-center ${confirmLabels[pendingType].bg}`}>
            <p className={`text-base font-bold mb-1 ${confirmLabels[pendingType].color}`}>
              {confirmLabels[pendingType].title}
            </p>
            <p className="text-sm text-gray-600">
              {pendingType === 'complete' && `Collect ${formatPeso(amountDue)} — this loan will be marked complete.`}
              {pendingType === 'interest_only' && `Collect ${formatPeso(interest)} interest. Capital ${formatPeso(effectiveCapital)} rolls over next month.`}
              {pendingType === 'partial' && `Collect ${formatPeso(parseFloat(partialAmount))}. Remaining ${formatPeso(amountDue - parseFloat(partialAmount))} + ${rate}% interest due next month.`}
              {pendingType === 'lapsed' && `Interest ${formatPeso(interest)} logged as unpaid debt. Capital ${formatPeso(effectiveCapital)} rolls over next month.`}
            </p>
            {note && <p className="text-xs text-gray-400 mt-2 italic">Note: "{note}"</p>}
          </div>

          <p className="text-sm text-center text-gray-500">Are you sure you want to proceed?</p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="full"
              onClick={() => setStep(pendingType === 'partial' ? 'partial' : 'choose')}
            >
              No, Go Back
            </Button>
            <Button
              size="full"
              onClick={handleCollect}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? 'Recording...' : 'Yes, Confirm'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

const GROUPS = [
  { key: 'overdue',  label: 'Overdue',   filter: (d) => d < 0,  badge: 'bg-red-500 text-white',          header: 'bg-red-50 border-red-200 text-red-700',    defaultOpen: false },
  { key: 'today',   label: 'Today',     filter: (d) => d === 0, badge: 'bg-orange-500 text-white',       header: 'bg-orange-50 border-orange-200 text-orange-700', defaultOpen: true },
  { key: 'tomorrow',label: 'Tomorrow',  filter: (d) => d === 1, badge: 'bg-yellow-400 text-gray-900',    header: 'bg-yellow-50 border-yellow-200 text-yellow-700', defaultOpen: true },
  { key: 'in2days', label: 'In 2 Days', filter: (d) => d === 2, badge: 'bg-green-400 text-white',        header: 'bg-green-50 border-green-200 text-green-700',  defaultOpen: false },
]

function CollectionGroups({ payments, onPay }) {
  const [open, setOpen] = useState(() =>
    Object.fromEntries(GROUPS.map((g) => [g.key, g.defaultOpen]))
  )

  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div className="flex flex-col gap-2">
      {GROUPS.map((g) => {
        const items = payments.filter((p) => g.filter(getDayDiff(p.due_date)))
        if (items.length === 0) return null
        return (
          <div key={g.key} className="flex flex-col gap-1">
            <button
              onClick={() => toggle(g.key)}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border font-medium text-sm ${g.header}`}
            >
              <div className="flex items-center gap-2">
                <span>{g.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.badge}`}>{items.length}</span>
              </div>
              {open[g.key] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {open[g.key] && (
              <div className="flex flex-col gap-1.5 pl-1">
                {items.map((p) => (
                  <PaymentItem key={p.id} payment={p} onPay={onPay} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Home() {
  const { data: payments = [], isLoading } = useUpcomingPayments()
  const markPaid = useMarkPaid()
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [installDismissed, setInstallDismissed] = useState(false)
  const { canInstall, install } = useInstallPrompt()

  const sorted = [...payments]
    .filter((p) => filter === 'all' || p.loan?.type === filter)
    .sort((a, b) => getDayDiff(a.due_date) - getDayDiff(b.due_date))

  return (
    <PageWrapper title="Collections">
      {canInstall && !installDismissed && (
        <div className="bg-teal-600 text-white rounded-xl px-4 py-3 flex items-center gap-3 mb-3">
          <Download size={18} className="shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Install JAR App</p>
            <p className="text-xs text-teal-200">Tap to add to your home screen</p>
          </div>
          <button
            onClick={install}
            className="bg-white text-teal-700 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0"
          >
            Install
          </button>
          <button onClick={() => setInstallDismissed(true)} className="text-teal-300 text-lg leading-none shrink-0">✕</button>
        </div>
      )}
      <div className="flex gap-2 mb-3">
        {[
          { value: 'all', label: 'All' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'weekly', label: 'Weekly' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-gray-400 py-10">Loading...</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="font-medium text-gray-700">All clear!</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'all' ? 'No collections due in the next 3 days.' : `No ${filter} collections due.`}
          </p>
        </div>
      ) : (
        <CollectionGroups payments={sorted} onPay={setSelected} />
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Record Collection"
      >
        <CollectionModal
          selected={selected}
          payments={payments}
          onClose={() => setSelected(null)}
          markPaid={markPaid}
        />
      </Modal>

      <FAB />
    </PageWrapper>
  )
}

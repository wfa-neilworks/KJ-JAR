import { useState } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { CheckCircle } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import FAB from '@/components/layout/FAB'
import { useUpcomingPayments, useMarkPaid } from '@/hooks/usePayments'
import { useToast } from '@/components/ui/Toast'
import { formatPeso } from '@/lib/loanUtils'
import { cn } from '@/lib/utils'

function getDayDiff(dueDateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
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
          {payment.loan?.type === 'weekly' ? `Week ${payment.week_number} of 6` : 'Monthly payment'} &nbsp;·&nbsp; {format(new Date(payment.due_date), 'MMM d, yyyy')}
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

export default function Home() {
  const { data: payments = [], isLoading } = useUpcomingPayments()
  const markPaid = useMarkPaid()
  const toast = useToast()
  const [selected, setSelected] = useState(null)

  const sorted = [...payments].sort((a, b) => {
    const da = getDayDiff(a.due_date)
    const db = getDayDiff(b.due_date)
    return da - db
  })

  const handleConfirmPay = async () => {
    if (!selected) return
    try {
      const loanPayments = payments.filter((p) => p.loan_id === selected.loan_id)
      const unpaid = loanPayments.filter((p) => !p.paid_at && p.id !== selected.id)
      await markPaid.mutateAsync({
        paymentId: selected.id,
        loanId: selected.loan_id,
        isLastPayment: unpaid.length === 0,
      })
      toast({ message: 'Payment marked as collected!', type: 'success' })
      setSelected(null)
    } catch {
      toast({ message: 'Failed to record payment', type: 'error' })
    }
  }

  return (
    <PageWrapper title="JAR — Collections">
      {isLoading ? (
        <p className="text-center text-gray-400 py-10">Loading...</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="font-medium text-gray-700">All clear!</p>
          <p className="text-sm text-gray-400 mt-1">No collections due in the next 3 days.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((p) => (
            <PaymentItem key={p.id} payment={p} onPay={setSelected} />
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Confirm Collection"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Borrower</span>
                <span className="font-medium text-gray-900">{selected.loan?.borrower?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-900">{formatPeso(selected.amount_due)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Due Date</span>
                <span className="text-gray-700">{format(new Date(selected.due_date), 'MMMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type</span>
                <span className="capitalize text-gray-700">{selected.loan?.type}</span>
              </div>
            </div>
            <Button size="full" onClick={handleConfirmPay} disabled={markPaid.isPending}>
              {markPaid.isPending ? 'Recording...' : 'Mark as Collected'}
            </Button>
            <Button size="full" variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        )}
      </Modal>

      <FAB />
    </PageWrapper>
  )
}

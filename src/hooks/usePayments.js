import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, addDays, addMonths, startOfDay } from 'date-fns'

export function useUpcomingPayments() {
  return useQuery({
    queryKey: ['payments', 'upcoming'],
    queryFn: async () => {
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const dayAfterTomorrow = format(addDays(new Date(), 2), 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('payments')
        .select('*, loan:loans(id, type, principal, interest_rate, total_due, borrower:borrowers(id, name, mobile))')
        .is('paid_at', null)
        .lte('due_date', dayAfterTomorrow)
        .order('due_date', { ascending: true })

      if (error) throw error
      return data
    },
    refetchInterval: 60000,
  })
}

export function useMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, loanId, collectionType, amountPaid, rolloverAmount, interestRate, note }) => {
      const now = new Date().toISOString()

      // Mark current payment as paid with actual amount and type
      const { error } = await supabase
        .from('payments')
        .update({
          paid_at: now,
          amount_paid: amountPaid,
          collection_type: collectionType,
          note: note || null,
        })
        .eq('id', paymentId)
      if (error) throw error

      // For interest_only and partial: add a rollover payment row next month
      if (collectionType === 'interest_only' || collectionType === 'partial') {
        const newCapital = rolloverAmount
        const newTotalDue = newCapital * (1 + interestRate / 100)
        const newDueDate = format(addMonths(new Date(), 1), 'yyyy-MM-dd')

        // Get current max week_number for this loan to increment
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('week_number')
          .eq('loan_id', loanId)
          .order('week_number', { ascending: false })
          .limit(1)
        const nextWeekNumber = (existingPayments?.[0]?.week_number || 1) + 1

        const { error: rollErr } = await supabase.from('payments').insert({
          loan_id: loanId,
          week_number: nextWeekNumber,
          amount_due: newTotalDue,
          due_date: newDueDate,
        })
        if (rollErr) throw rollErr
      } else {
        // Check directly in DB whether any other unpaid rows remain for this loan
        const { data: remaining } = await supabase
          .from('payments')
          .select('id')
          .eq('loan_id', loanId)
          .is('paid_at', null)
          .neq('id', paymentId)
          .limit(1)

        if (!remaining || remaining.length === 0) {
          const { error: loanErr } = await supabase
            .from('loans')
            .update({ status: 'completed' })
            .eq('id', loanId)
          if (loanErr) throw loanErr
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

function interestPortion(payment) {
  const { loan } = payment
  if (!loan) return 0
  const principal = Number(loan.principal)
  const rate = Number(loan.interest_rate)
  const interest = principal * (rate / 100)

  if (loan.type === 'monthly') return interest

  // Weekly: profit is only counted on the LAST payment (week 6)
  if (payment.is_last_payment) return interest
  return 0
}

async function fetchPaidWithLastFlag(extraFilter) {
  const { data, error } = await supabase
    .from('payments')
    .select('loan_id, week_number, paid_at, amount_due, amount_paid, collection_type, loan:loans(type, principal, interest_rate)')
    .not('paid_at', 'is', null)
  if (error) throw error

  // For each loan, find the max week_number among all its payments (paid or not)
  const { data: allRows } = await supabase
    .from('payments')
    .select('loan_id, week_number')
  const maxWeek = {}
  ;(allRows || []).forEach((r) => {
    if (!maxWeek[r.loan_id] || r.week_number > maxWeek[r.loan_id]) {
      maxWeek[r.loan_id] = r.week_number
    }
  })

  return data.map((p) => ({
    ...p,
    is_last_payment: p.week_number === maxWeek[p.loan_id],
  }))
}

export function useCollectedByMonth(type) {
  return useQuery({
    queryKey: ['payments', 'collected-by-month', type],
    queryFn: async () => {
      const data = await fetchPaidWithLastFlag()

      const filtered = type ? data.filter((p) => p.loan?.type === type) : data

      const map = {}
      filtered.forEach((p) => {
        const month = format(new Date(p.paid_at), 'yyyy-MM')
        map[month] = (map[month] || 0) + interestPortion(p)
      })

      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - i)
        const key = format(d, 'yyyy-MM')
        months.push({ month: format(d, 'MMM yy'), amount: map[key] || 0 })
      }
      return months
    },
  })
}

export function useDashboardStats(type) {
  return useQuery({
    queryKey: ['dashboard-stats', type],
    queryFn: async () => {
      // Step 1: get active loans of this type
      const { data: loans, error: lErr } = await supabase
        .from('loans')
        .select('id, principal, interest_rate')
        .eq('type', type)
        .eq('status', 'active')
      if (lErr) throw lErr

      const activeCount = loans.length
      console.log('[stats] type=', type, 'loans=', JSON.stringify(loans))
      if (activeCount === 0) {
        // Still need profit even if no active loans
        const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
        const allPaid = await fetchPaidWithLastFlag()
        const collected = allPaid
          .filter((p) => p.paid_at >= startOfMonth && p.loan?.type === type)
          .reduce((s, p) => s + interestPortion(p), 0)
        return { totalLent: 0, outstanding: 0, collected, activeCount: 0 }
      }

      const activeLoanIds = loans.map((l) => l.id)
      const rateMap = {}
      loans.forEach((l) => { rateMap[l.id] = Number(l.interest_rate) })

      // Step 2: get all unpaid payment rows for those specific loan IDs
      const { data: unpaidRows, error: uErr } = await supabase
        .from('payments')
        .select('loan_id, amount_due')
        .is('paid_at', null)
        .in('loan_id', activeLoanIds)
      if (uErr) throw uErr

      // Outstanding = sum of all unpaid amount_due
      const outstanding = unpaidRows.reduce((s, p) => s + Number(p.amount_due), 0)

      // Total Lent = capital portion of each unpaid row
      // capital = amount_due / (1 + rate/100)
      const totalLent = unpaidRows.reduce((s, p) => {
        const rate = rateMap[p.loan_id] || 0
        return s + Number(p.amount_due) / (1 + rate / 100)
      }, 0)

      // Step 3: profit = interest on paid payments this month for this loan type
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
      const allPaid = await fetchPaidWithLastFlag()
      const collected = allPaid
        .filter((p) => p.paid_at >= startOfMonth && p.loan?.type === type)
        .reduce((s, p) => s + interestPortion(p), 0)

      return { totalLent, outstanding, collected, activeCount }
    },
  })
}

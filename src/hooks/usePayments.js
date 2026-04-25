import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format, addDays, startOfDay } from 'date-fns'

export function useUpcomingPayments() {
  return useQuery({
    queryKey: ['payments', 'upcoming'],
    queryFn: async () => {
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const dayAfterTomorrow = format(addDays(new Date(), 2), 'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('payments')
        .select('*, loan:loans(id, type, principal, borrower:borrowers(id, name, mobile))')
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
    mutationFn: async ({ paymentId, loanId, isLastPayment }) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('payments')
        .update({ paid_at: now })
        .eq('id', paymentId)
      if (error) throw error

      if (isLastPayment) {
        const { error: loanErr } = await supabase
          .from('loans')
          .update({ status: 'completed' })
          .eq('id', loanId)
        if (loanErr) throw loanErr
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
    },
  })
}

export function useCollectedByMonth(type) {
  return useQuery({
    queryKey: ['payments', 'collected-by-month', type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('paid_at, amount_due, loan:loans(type)')
        .not('paid_at', 'is', null)

      if (error) throw error

      const filtered = type ? data.filter((p) => p.loan?.type === type) : data

      const map = {}
      filtered.forEach((p) => {
        const month = format(new Date(p.paid_at), 'yyyy-MM')
        map[month] = (map[month] || 0) + Number(p.amount_due)
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
      const { data: loans, error: lErr } = await supabase
        .from('loans')
        .select('principal, total_due, status')
        .eq('type', type)
      if (lErr) throw lErr

      const active = loans.filter((l) => l.status === 'active')
      const totalLent = active.reduce((s, l) => s + Number(l.principal), 0)
      const outstanding = active.reduce((s, l) => s + Number(l.total_due), 0)
      const activeCount = active.length

      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
      const { data: paidThisMonth, error: pErr } = await supabase
        .from('payments')
        .select('amount_due, loan:loans(type)')
        .gte('paid_at', startOfMonth)
        .not('paid_at', 'is', null)
      if (pErr) throw pErr

      const collected = paidThisMonth
        .filter((p) => p.loan?.type === type)
        .reduce((s, p) => s + Number(p.amount_due), 0)

      return { totalLent, outstanding, collected, activeCount }
    },
  })
}

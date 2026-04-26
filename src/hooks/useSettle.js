import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useSettleLoans() {
  return useQuery({
    queryKey: ['settle-loans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settle_loans')
        .select('*, borrower:borrowers(id, name, mobile), payments:settle_payments(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateSettleLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ borrower_id, principal, loan_date }) => {
      const { data, error } = await supabase
        .from('settle_loans')
        .insert({ borrower_id, principal, loan_date, status: 'active' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settle-loans'] }),
  })
}

export function useDeleteSettleLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (loanId) => {
      const { data: paid } = await supabase
        .from('settle_payments')
        .select('id')
        .eq('loan_id', loanId)
        .limit(1)
      if (paid && paid.length > 0) throw new Error('has_payments')

      const { error } = await supabase.from('settle_loans').delete().eq('id', loanId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settle-loans'] }),
  })
}

export function useCollectSettlePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loanId, principal, totalPaid, amount, note }) => {
      const { error: payErr } = await supabase
        .from('settle_payments')
        .insert({ loan_id: loanId, amount, note: note || null })
      if (payErr) throw payErr

      // Auto-complete if total paid reaches principal
      if (totalPaid + amount >= principal) {
        const { error: loanErr } = await supabase
          .from('settle_loans')
          .update({ status: 'completed' })
          .eq('id', loanId)
        if (loanErr) throw loanErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settle-loans'] }),
  })
}

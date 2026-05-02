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

export function useSettleLoansByBorrower(borrowerId) {
  return useQuery({
    queryKey: ['settle-loans', 'borrower', borrowerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settle_loans')
        .select('*, payments:settle_payments(*)')
        .eq('borrower_id', borrowerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!borrowerId,
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

export function useEditSettleLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, principal, loan_date }) => {
      const { error } = await supabase
        .from('settle_loans')
        .update({ principal, loan_date })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settle-loans'] }),
  })
}

export function useEditSettlePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, loanId, oldAmount, newAmount, newNote, principal, totalPaid }) => {
      const { error } = await supabase
        .from('settle_payments')
        .update({ amount: newAmount, note: newNote || null })
        .eq('id', id)
      if (error) throw error

      // Recompute whether loan should be active or completed after edit
      const newTotal = totalPaid - oldAmount + newAmount
      const newStatus = newTotal >= principal ? 'completed' : 'active'
      const { error: loanErr } = await supabase
        .from('settle_loans')
        .update({ status: newStatus })
        .eq('id', loanId)
      if (loanErr) throw loanErr
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

export function useDeleteSettlePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, loanId, paymentAmount, totalPaid, principal }) => {
      const { error } = await supabase.from('settle_payments').delete().eq('id', paymentId)
      if (error) throw error

      // If loan was completed but deleting this payment drops total below principal, revert to active
      const newTotal = totalPaid - paymentAmount
      if (newTotal < principal) {
        const { error: loanErr } = await supabase
          .from('settle_loans')
          .update({ status: 'active' })
          .eq('id', loanId)
        if (loanErr) throw loanErr
      }
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

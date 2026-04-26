import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { generatePayments } from '@/lib/loanUtils'

export function useLoans(type) {
  return useQuery({
    queryKey: ['loans', type],
    queryFn: async () => {
      let query = supabase
        .from('loans')
        .select('*, borrower:borrowers(id, name, mobile)')
        .order('created_at', { ascending: false })
      if (type) query = query.eq('type', type)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useLoansByBorrower(borrowerId) {
  return useQuery({
    queryKey: ['loans', 'borrower', borrowerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select('*, payments(*)')
        .eq('borrower_id', borrowerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!borrowerId,
  })
}

export function useEditLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, principal, interest_rate, loan_date, type }) => {
      const total_due = principal * (1 + interest_rate / 100)
      const { error } = await supabase
        .from('loans')
        .update({ principal, interest_rate, loan_date, total_due })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useEditPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, amount_due, amount_paid, due_date, loan, week_number }) => {
      const rate = Number(loan.interest_rate)
      const interest = Number(loan.principal) * (rate / 100)

      // Determine collection type from new amounts
      let collection_type = null
      if (amount_paid !== null && amount_paid !== undefined) {
        const paid = Number(amount_paid)
        const due = Number(amount_due)
        if (Math.abs(paid - due) < 0.01) collection_type = 'complete'
        else if (Math.abs(paid - interest) < 0.01) collection_type = 'interest_only'
        else collection_type = 'partial'
      }

      // Save the edited payment
      const updates = { amount_due, due_date }
      if (amount_paid !== null && amount_paid !== undefined) {
        updates.amount_paid = amount_paid
        updates.collection_type = collection_type
      }
      const { error } = await supabase.from('payments').update(updates).eq('id', id)
      if (error) throw error

      // Waterfall: find the next unpaid rollover row and recalculate it
      if (collection_type === 'partial' || collection_type === 'interest_only') {
        const { data: nextRows } = await supabase
          .from('payments')
          .select('id, week_number')
          .eq('loan_id', loan.id)
          .is('paid_at', null)
          .gt('week_number', week_number)
          .order('week_number', { ascending: true })
          .limit(1)

        if (nextRows && nextRows.length > 0) {
          const remaining = Number(amount_due) - Number(amount_paid)
          // For interest_only: remaining is the full original capital (amount_due - interest)
          const newCapital = collection_type === 'interest_only'
            ? Number(amount_due) - interest
            : remaining
          const newAmountDue = newCapital * (1 + rate / 100)
          const { error: rollErr } = await supabase
            .from('payments')
            .update({ amount_due: newAmountDue })
            .eq('id', nextRows[0].id)
          if (rollErr) throw rollErr
        }
      } else if (collection_type === 'complete') {
        // If edited to complete, delete any unpaid rollover rows after this one
        const { data: futureRows } = await supabase
          .from('payments')
          .select('id')
          .eq('loan_id', loan.id)
          .is('paid_at', null)
          .gt('week_number', week_number)
        if (futureRows && futureRows.length > 0) {
          await supabase
            .from('payments')
            .delete()
            .in('id', futureRows.map((r) => r.id))
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeleteLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (loanId) => {
      // Check if any payment has been made
      const { data: paid } = await supabase
        .from('payments')
        .select('id')
        .eq('loan_id', loanId)
        .not('paid_at', 'is', null)
        .limit(1)
      if (paid && paid.length > 0) throw new Error('has_payments')

      // Delete all payment rows first, then the loan
      await supabase.from('payments').delete().eq('loan_id', loanId)
      const { error } = await supabase.from('loans').delete().eq('id', loanId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (loanData) => {
      const { data: loan, error: loanErr } = await supabase
        .from('loans')
        .insert({
          borrower_id: loanData.borrower_id,
          type: loanData.type,
          principal: loanData.principal,
          interest_rate: loanData.interest_rate,
          total_due: loanData.total_due,
          loan_date: loanData.loan_date,
          status: 'active',
        })
        .select()
        .single()
      if (loanErr) throw loanErr

      const payments = generatePayments(
        loan.id,
        loan.type,
        loan.principal,
        loan.interest_rate,
        loan.loan_date
      )
      const { error: payErr } = await supabase.from('payments').insert(payments)
      if (payErr) throw payErr

      return loan
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

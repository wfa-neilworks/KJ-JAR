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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })
}

export function useEditPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, amount_due, amount_paid, due_date, loan }) => {
      const principal = Number(loan.principal)
      const rate = Number(loan.interest_rate)
      const interest = principal * (rate / 100)

      let collection_type = null
      if (amount_paid !== null && amount_paid !== undefined) {
        const paid = Number(amount_paid)
        const due = Number(amount_due)
        if (Math.abs(paid - due) < 0.01) collection_type = 'complete'
        else if (Math.abs(paid - interest) < 0.01) collection_type = 'interest_only'
        else collection_type = 'partial'
      }

      const updates = { amount_due, due_date }
      if (amount_paid !== null && amount_paid !== undefined) {
        updates.amount_paid = amount_paid
        updates.collection_type = collection_type
      }

      const { error } = await supabase.from('payments').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
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

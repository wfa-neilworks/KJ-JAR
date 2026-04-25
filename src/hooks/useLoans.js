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

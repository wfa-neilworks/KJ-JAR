import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { generatePayments } from '@/lib/loanUtils'
import { addDays, addMonths, format } from 'date-fns'

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

      // Recalculate due dates for unpaid rows based on new loan_date
      if (type === 'monthly') {
        const { data: unpaidRows } = await supabase
          .from('payments')
          .select('id')
          .eq('loan_id', id)
          .is('paid_at', null)
          .limit(1)

        if (unpaidRows && unpaidRows.length > 0) {
          const newDueDate = format(addMonths(new Date(loan_date), 1), 'yyyy-MM-dd')
          await supabase.from('payments').update({ due_date: newDueDate }).eq('id', unpaidRows[0].id)
        }
      }

      if (type === 'weekly') {
        const { data: unpaidRows } = await supabase
          .from('payments')
          .select('id, week_number')
          .eq('loan_id', id)
          .is('paid_at', null)
          .order('week_number', { ascending: true })

        if (unpaidRows && unpaidRows.length > 0) {
          const base = new Date(loan_date)
          for (const row of unpaidRows) {
            const newDueDate = format(addDays(base, row.week_number * 7), 'yyyy-MM-dd')
            await supabase.from('payments').update({ due_date: newDueDate }).eq('id', row.id)
          }
        }
      }
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
    mutationFn: async ({ id, amount_due, amount_paid, due_date, note, loan, week_number }) => {
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
      const updates = { amount_due, due_date, note: note ?? null }
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
        // Delete any unpaid rollover rows after this one
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

        // After clearing future rows, check if any unpaid rows still remain for this loan
        const { data: stillUnpaid } = await supabase
          .from('payments')
          .select('id')
          .eq('loan_id', loan.id)
          .is('paid_at', null)
          .limit(1)

        if (!stillUnpaid || stillUnpaid.length === 0) {
          const { error: loanErr } = await supabase
            .from('loans')
            .update({ status: 'completed' })
            .eq('id', loan.id)
          if (loanErr) throw loanErr
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
        loan.loan_date,
        loanData.weeks
      )
      const { error: payErr } = await supabase.from('payments').insert(payments)
      if (payErr) throw payErr

      return loan
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useRenewLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loanId, newPrincipal, oldPrincipal, interestRate }) => {
      const now = new Date().toISOString()
      const interest = oldPrincipal * (interestRate / 100)

      // 1. Get all payment rows for this loan
      const { data: allRows, error: fetchErr } = await supabase
        .from('payments')
        .select('id, week_number, paid_at')
        .eq('loan_id', loanId)
        .order('week_number', { ascending: true })
      if (fetchErr) throw fetchErr

      const maxWeek = allRows.reduce((m, r) => Math.max(m, r.week_number), 0)
      const unpaidIds = allRows.filter((r) => !r.paid_at).map((r) => r.id)

      // 2. Delete all unpaid rows
      if (unpaidIds.length > 0) {
        const { error: delErr } = await supabase
          .from('payments')
          .delete()
          .in('id', unpaidIds)
        if (delErr) throw delErr
      }

      // 3. Insert renewal marker row — paid immediately, books the interest as profit
      const { error: markerErr } = await supabase.from('payments').insert({
        loan_id: loanId,
        week_number: maxWeek + 1,
        amount_due: interest,
        amount_paid: interest,
        paid_at: now,
        collection_type: 'complete',
        is_renewal_marker: true,
        due_date: format(new Date(), 'yyyy-MM-dd'),
      })
      if (markerErr) throw markerErr

      // 4. Insert 6 new weekly payment rows from today using the new principal
      const weeklyAmount = newPrincipal * 1.20 / 6
      const newRows = Array.from({ length: 6 }, (_, i) => ({
        loan_id: loanId,
        week_number: maxWeek + 2 + i,
        amount_due: weeklyAmount,
        due_date: format(addDays(new Date(), (i + 1) * 7), 'yyyy-MM-dd'),
      }))
      const { error: insertErr } = await supabase.from('payments').insert(newRows)
      if (insertErr) throw insertErr

      // 5. Update the loan's principal and total_due to the new capital
      const newTotalDue = newPrincipal * 1.20
      const { error: loanErr } = await supabase
        .from('loans')
        .update({ principal: newPrincipal, total_due: newTotalDue })
        .eq('id', loanId)
      if (loanErr) throw loanErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

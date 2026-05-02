import { addMonths, addDays, format } from 'date-fns'

export function calcTotalDue(principal, interestRate) {
  return principal * (1 + interestRate / 100)
}

export function calcWeeklyAmount(principal, weeks = 6) {
  return calcTotalDue(principal, 20) / weeks
}

export function generatePayments(loanId, type, principal, interestRate, loanDate, weeks = 6) {
  const date = new Date(loanDate)
  if (type === 'monthly') {
    const dueDate = addMonths(date, 1)
    return [
      {
        loan_id: loanId,
        week_number: 1,
        amount_due: calcTotalDue(principal, interestRate),
        due_date: format(dueDate, 'yyyy-MM-dd'),
      },
    ]
  }

  const weeklyAmount = calcWeeklyAmount(principal, weeks)
  return Array.from({ length: weeks }, (_, i) => ({
    loan_id: loanId,
    week_number: i + 1,
    amount_due: weeklyAmount,
    due_date: format(addDays(date, (i + 1) * 7), 'yyyy-MM-dd'),
  }))
}

export function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

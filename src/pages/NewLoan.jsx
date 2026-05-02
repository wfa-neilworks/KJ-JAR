import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useBorrowers } from '@/hooks/useBorrowers'
import { useCreateLoan } from '@/hooks/useLoans'
import { useCreateSettleLoan } from '@/hooks/useSettle'
import { useToast } from '@/components/ui/Toast'
import { calcTotalDue, calcWeeklyAmount, formatPeso } from '@/lib/loanUtils'
import { format } from 'date-fns'

export default function NewLoan() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: borrowers = [] } = useBorrowers()
  const createLoan = useCreateLoan()
  const createSettleLoan = useCreateSettleLoan()

  const activeBorrowers = borrowers.filter((b) => b.is_active)

  const [form, setForm] = useState({
    borrower_id: '',
    principal: '',
    type: '',
    interest_rate: '',
    weeks: 6,
    commission: false,
    commission_rate: null,
    loan_date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [errors, setErrors] = useState({})
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const filteredBorrowers = activeBorrowers.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedBorrower = activeBorrowers.find((b) => b.id === form.borrower_id)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: (typeof v === 'string' || typeof v === 'number') ? v : v.target.value }))

  const preview = useMemo(() => {
    const p = parseFloat(form.principal)
    if (!p || !form.type) return null
    const rate = form.type === 'weekly' ? 20 : parseFloat(form.interest_rate)
    if (!rate) return null
    const total = calcTotalDue(p, rate)
    const grossInterest = p * (rate / 100)
    const commissionAmt = form.commission && form.commission_rate ? grossInterest * (form.commission_rate / 100) : 0
    const netProfit = grossInterest - commissionAmt
    if (form.type === 'weekly') {
      const weekly = calcWeeklyAmount(p, form.weeks)
      return { total, weekly, weeks: form.weeks, grossInterest, commissionAmt, netProfit }
    }
    return { total, grossInterest, commissionAmt, netProfit }
  }, [form.principal, form.type, form.interest_rate, form.weeks, form.commission, form.commission_rate])

  const validate = () => {
    const e = {}
    if (!form.borrower_id) e.borrower_id = 'Select a borrower'
    if (!form.principal || parseFloat(form.principal) <= 0) e.principal = 'Enter a valid amount'
    if (!form.type) e.type = 'Select a loan term'
    if (form.type === 'monthly' && !form.interest_rate) e.interest_rate = 'Select interest rate'
    if ((form.type === 'weekly' || form.type === 'monthly') && form.commission && !form.commission_rate) e.commission_rate = 'Select a commission rate'
    if (!form.loan_date) e.loan_date = 'Pick a loan date'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const principal = parseFloat(form.principal)
    try {
      if (form.type === 'settle') {
        await createSettleLoan.mutateAsync({
          borrower_id: form.borrower_id,
          principal,
          loan_date: form.loan_date,
        })
        toast({ message: 'Loan created successfully!', type: 'success' })
        navigate('/settle')
      } else {
        const rate = form.type === 'weekly' ? 20 : parseFloat(form.interest_rate)
        const total_due = calcTotalDue(principal, rate)
        await createLoan.mutateAsync({
          borrower_id: form.borrower_id,
          type: form.type,
          principal,
          interest_rate: rate,
          total_due,
          loan_date: form.loan_date,
          weeks: form.type === 'weekly' ? form.weeks : undefined,
          commission_rate: form.commission ? form.commission_rate : null,
        })
        toast({ message: 'Loan created successfully!', type: 'success' })
        navigate('/')
      }
    } catch {
      toast({ message: 'Failed to create loan. Please try again.', type: 'error' })
    }
  }

  const isPending = createLoan.isPending || createSettleLoan.isPending

  return (
    <PageWrapper
      title="New Loan"
      action={
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        {/* Borrower search */}
        <div className="flex flex-col gap-1 relative">
          <label className="text-sm font-medium text-gray-700">Borrower *</label>
          <input
            type="text"
            value={selectedBorrower ? selectedBorrower.name : search}
            onChange={(e) => {
              setSearch(e.target.value)
              set('borrower_id')('')
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search borrower..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.borrower_id && <span className="text-xs text-red-500">{errors.borrower_id}</span>}
          {showDropdown && !selectedBorrower && filteredBorrowers.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {filteredBorrowers.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  onClick={() => {
                    set('borrower_id')(b.id)
                    setSearch(b.name)
                    setShowDropdown(false)
                  }}
                >
                  <p className="text-sm font-medium text-gray-900">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.mobile}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Principal */}
        <Input
          label="Principal Amount (PHP) *"
          type="number"
          min="1"
          step="0.01"
          value={form.principal}
          onChange={set('principal')}
          placeholder="10000"
          error={errors.principal}
        />

        {/* Loan type */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Loan Term *</label>
          <div className="flex gap-2">
            {[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'settle', label: 'To Settle' },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { set('type')(t.value); set('interest_rate')('') }}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.type === t.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {errors.type && <span className="text-xs text-red-500">{errors.type}</span>}
        </div>

        {form.type === 'settle' && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-700">
            No interest, no due date — payments collected anytime until fully settled.
          </div>
        )}

        {/* Interest rate — hidden for settle */}
        {form.type === 'weekly' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Interest Rate</label>
            <div className="bg-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-500">
              20% (fixed for weekly loans)
            </div>
          </div>
        )}
        {form.type === 'weekly' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Number of Weeks *</label>
            <div className="flex gap-2">
              {[6, 8, 12].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => set('weeks')(w)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    form.weeks === w
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {w} weeks
                </button>
              ))}
            </div>
          </div>
        )}
        {form.type === 'monthly' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Interest Rate *</label>
            <div className="flex gap-2">
              {[10, 15, 20].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('interest_rate')(String(r))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.interest_rate === String(r)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
            {errors.interest_rate && <span className="text-xs text-red-500">{errors.interest_rate}</span>}
          </div>
        )}

        {/* MM Commission — weekly and monthly only */}
        {(form.type === 'weekly' || form.type === 'monthly') && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">MM Commission</span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, commission: !f.commission, commission_rate: !f.commission ? null : f.commission_rate }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.commission ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.commission ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {form.commission && (
              <div className="flex gap-2">
                {[5, 10].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, commission_rate: r }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.commission_rate === r
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            )}
            {form.commission && !form.commission_rate && (
              <span className="text-xs text-red-500">Select a commission rate</span>
            )}
          </div>
        )}

        {/* Loan date */}
        <Input
          label="Loan Date *"
          type="date"
          value={form.loan_date}
          onChange={set('loan_date')}
          error={errors.loan_date}
        />

        {/* Preview — only for weekly/monthly */}
        {preview && form.type !== 'settle' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-sm font-semibold text-blue-800">Loan Preview</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Due</span>
              <span className="font-semibold text-gray-900">{formatPeso(preview.total)}</span>
            </div>
            {preview.weekly && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Weekly Payment</span>
                  <span className="font-semibold text-gray-900">{formatPeso(preview.weekly)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Duration</span>
                  <span className="text-gray-700">{preview.weeks} weeks</span>
                </div>
              </>
            )}
            {form.commission && form.commission_rate && (
              <>
                <div className="border-t border-blue-200 my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gross Interest</span>
                  <span className="text-gray-700">{formatPeso(preview.grossInterest)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Commission ({form.commission_rate}%)</span>
                  <span className="text-orange-600">− {formatPeso(preview.commissionAmt)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Net Profit</span>
                  <span className="text-green-700">{formatPeso(preview.netProfit)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <Button type="submit" size="full" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Loan'}
        </Button>
      </form>
    </PageWrapper>
  )
}

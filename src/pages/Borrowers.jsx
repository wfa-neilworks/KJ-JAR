import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, ChevronRight, UserCheck, UserX, Search } from 'lucide-react'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useBorrowers, useAddBorrower, useSetBorrowerActive } from '@/hooks/useBorrowers'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

function BorrowerForm({ onClose }) {
  const toast = useToast()
  const addBorrower = useAddBorrower()
  const [form, setForm] = useState({ name: '', mobile: '', address: '', facebook: '', guarantor: '' })
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.mobile.trim()) e.mobile = 'Mobile is required'
    if (!form.address.trim()) e.address = 'Address is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    try {
      await addBorrower.mutateAsync(form)
      toast({ message: 'Borrower added successfully', type: 'success' })
      onClose()
    } catch {
      toast({ message: 'Failed to add borrower', type: 'error' })
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input label="Full Name *" value={form.name} onChange={set('name')} placeholder="Juan dela Cruz" error={errors.name} />
      <Input label="Mobile Number *" value={form.mobile} onChange={set('mobile')} placeholder="09xxxxxxxxx" error={errors.mobile} />
      <Input label="Address *" value={form.address} onChange={set('address')} placeholder="Barangay, City" error={errors.address} />
      <Input label="Facebook" value={form.facebook} onChange={set('facebook')} placeholder="facebook.com/..." />
      <Input label="Guarantor" value={form.guarantor} onChange={set('guarantor')} placeholder="Guarantor name" />
      <Button type="submit" size="full" disabled={addBorrower.isPending}>
        {addBorrower.isPending ? 'Saving...' : 'Add Borrower'}
      </Button>
    </form>
  )
}

export default function Borrowers() {
  const { data: borrowers = [], isLoading } = useBorrowers()
  const setActive = useSetBorrowerActive()
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = borrowers
    .filter((b) => (tab === 'active' ? b.is_active : !b.is_active))
    .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.mobile.includes(search))

  const handleDeactivate = async (borrower) => {
    const { data: loans } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_id', borrower.id)
      .eq('status', 'active')
    if (loans && loans.length > 0) {
      toast({ message: 'Borrower has a pending loan. Cannot deactivate.', type: 'error' })
      return
    }
    await setActive.mutateAsync({ id: borrower.id, is_active: false })
    toast({ message: `${borrower.name} marked as inactive`, type: 'info' })
  }

  const handleReactivate = async (borrower) => {
    await setActive.mutateAsync({ id: borrower.id, is_active: true })
    toast({ message: `${borrower.name} reactivated`, type: 'success' })
  }

  return (
    <PageWrapper
      title="Borrowers"
      action={
        <Button size="sm" onClick={() => setShowForm(true)}>
          <UserPlus size={16} /> Add
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or mobile..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {['active', 'inactive'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center text-gray-400 py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No {tab} borrowers</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div
                className="flex-1 cursor-pointer"
                onClick={() => navigate(`/borrowers/${b.id}`)}
              >
                <p className="font-medium text-gray-900">{b.name}</p>
                <p className="text-sm text-gray-500">{b.mobile}</p>
              </div>
              <div className="flex items-center gap-2">
                {b.is_active ? (
                  <button
                    onClick={() => handleDeactivate(b)}
                    className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500"
                    title="Deactivate"
                  >
                    <UserX size={17} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(b)}
                    className="p-1.5 rounded-full hover:bg-green-50 text-gray-400 hover:text-green-600"
                    title="Reactivate"
                  >
                    <UserCheck size={17} />
                  </button>
                )}
                <ChevronRight size={18} className="text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Borrower">
        <BorrowerForm onClose={() => setShowForm(false)} />
      </Modal>
    </PageWrapper>
  )
}

import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function FAB() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/new-loan')}
      className="fixed bottom-20 right-5 sm:right-8 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-colors"
      aria-label="Add new loan"
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  )
}

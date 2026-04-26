import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Modal({ open, onClose, title, children, className }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-xl flex flex-col',
          // On mobile: sit above the 64px bottom nav, leave room for home indicator
          'max-h-[calc(100dvh-64px)] sm:max-h-[90vh]',
          className
        )}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="px-4 py-4 overflow-y-auto flex-1 pb-6">{children}</div>
      </div>
    </div>
  )
}

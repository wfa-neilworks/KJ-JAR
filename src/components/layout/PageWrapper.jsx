import { LogOut } from 'lucide-react'
import jarLogo from '@/assets/JAR-LOGO-CROPPED.png'
import { supabase } from '@/lib/supabase'

export default function PageWrapper({ title, children, action }) {
  const handleLogout = () => supabase.auth.signOut()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 w-full">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={jarLogo} alt="JAR" className="h-9 w-auto shrink-0" />
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {action && <div>{action}</div>}
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 py-4 pb-24 max-w-2xl mx-auto w-full">{children}</main>
    </div>
  )
}

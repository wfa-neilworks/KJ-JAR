import { NavLink } from 'react-router-dom'
import { Bell, CalendarDays, BarChart2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: Bell, label: 'Home' },
  { to: '/weekly', icon: CalendarDays, label: 'Weekly' },
  { to: '/monthly', icon: BarChart2, label: 'Monthly' },
  { to: '/borrowers', icon: Users, label: 'Borrowers' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around items-center h-16 px-2">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors text-xs font-medium',
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

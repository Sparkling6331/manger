import { NavLink } from 'react-router-dom'
import { Home, BookOpen, Scale, User, ChefHat } from 'lucide-react'

const tabs = [
  { to: '/', icon: Home, label: "Aujourd'hui" },
  { to: '/history', icon: BookOpen, label: 'Historique' },
  { to: '/recipes', icon: ChefHat, label: 'Recettes' },
  { to: '/weight', icon: Scale, label: 'Poids' },
  { to: '/profile', icon: User, label: 'Profil' },
]

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
      <div className="max-w-640px mx-auto flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                isActive ? 'text-green-600' : 'text-gray-400'
              }`
            }
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

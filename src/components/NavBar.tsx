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
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="max-w-[640px] mx-auto px-3 pb-2.5">
        <div
          className="flex bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-100"
          style={{ boxShadow: '0 8px 30px rgba(16, 24, 40, 0.12)' }}
        >
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center w-11 h-7 rounded-full transition-colors ${
                      isActive ? 'bg-green-600 text-white' : 'text-gray-400'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className={isActive ? 'text-green-700' : 'text-gray-400'}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

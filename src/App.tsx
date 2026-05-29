import { Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar'
import Today from './pages/Today'
import History from './pages/History'
import Recipes from './pages/Recipes'
import Weight from './pages/Weight'
import Profile from './pages/Profile'
import Foods from './pages/Foods'

export default function App() {
  return (
    <div className="flex flex-col min-h-dvh bg-green-50">
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/weight" element={<Weight />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/foods" element={<Foods />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  )
}

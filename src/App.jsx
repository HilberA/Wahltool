import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import AdminDashboard from './pages/AdminDashboard'
import AdminCreatePoll from './pages/AdminCreatePoll'
import Vote from './pages/Vote'
import Results from './pages/Results'

export default function App() {
  const location = useLocation()
  // Wer über einen Stimmzettel-Link kommt, soll keine Admin-Navigation sehen.
  const isVotingView = location.pathname.startsWith('/vote/')

  return (
    <div className="app-shell">
      <header className="masthead">
        <Link to={isVotingView ? location.pathname : '/admin'} className="brand">
          Abstimmungstool
        </Link>
        {!isVotingView && (
          <nav>
            <Link to="/admin">Übersicht</Link>
            <Link to="/admin/new">Neue Abstimmung</Link>
          </nav>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/new" element={<AdminCreatePoll />} />
        <Route path="/vote/:pollId" element={<Vote />} />
        <Route path="/results/:pollId" element={<Results />} />
        <Route path="*" element={<p>Seite nicht gefunden.</p>} />
      </Routes>
    </div>
  )
}

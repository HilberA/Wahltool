import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyPolls } from '../services'

export default function AdminDashboard() {
  const [polls, setPolls] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listMyPolls()
      .then(setPolls)
      .catch((err) => {
        console.error(err)
        setError('Umfragen konnten nicht geladen werden.')
      })
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Deine Abstimmungen</h2>
        <Link to="/admin/new" className="btn btn-primary">
          + Neue Abstimmung
        </Link>
      </div>

      {error && <div className="notice">{error}</div>}

      {polls === null && !error && <p>Lädt …</p>}

      {polls && polls.length === 0 && (
        <div className="empty-state card">
          <p>Noch keine Abstimmung erstellt.</p>
          <Link to="/admin/new" className="btn btn-primary">
            Erste Abstimmung erstellen
          </Link>
        </div>
      )}

      {polls && polls.length > 0 && (
        <div>
          {polls.map((poll) => (
            <div className="card" key={poll.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ marginBottom: '0.4rem' }}>{poll.question}</h3>
                <span className={`pill ${poll.status === 'open' ? 'pill-ok' : ''}`}>
                  {poll.status === 'open' ? 'offen' : 'geschlossen'}
                </span>
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginBottom: '0.75rem' }}>
                {poll.options.length} Optionen
              </p>
              <Link to={`/results/${poll.id}`} className="btn-ghost">
                Ergebnisse ansehen
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

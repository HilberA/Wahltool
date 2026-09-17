import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyPolls, deletePoll } from '../services'
import { isPollOpen, isAutoExpired, toDate } from '../services/pollStatus'
import { useAdminUser } from '../hooks/useAdminUser'
import { adminSignOut } from '../lib/firebase'
import QrCode from '../components/QrCode'

export default function AdminDashboard() {
  const user = useAdminUser()
  const [polls, setPolls] = useState(null)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [qrOpenId, setQrOpenId] = useState(null)

  function load() {
    listMyPolls()
      .then(setPolls)
      .catch((err) => {
        console.error(err)
        setError('Umfragen konnten nicht geladen werden.')
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDelete(poll) {
    const label = poll.questions?.[0]?.text || 'diese Umfrage'
    if (!confirm(`"${label}" wirklich unwiderruflich löschen? Das kann nicht rückgängig gemacht werden.`)) return
    setDeletingId(poll.id)
    try {
      await deletePoll(poll.id)
      setPolls((prev) => prev.filter((p) => p.id !== poll.id))
    } catch (err) {
      console.error(err)
      alert('Löschen fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Deine Abstimmungen</h2>
        <Link to="/admin/new" className="btn btn-primary">
          + Neue Abstimmung
        </Link>
      </div>

      {user && (
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          Angemeldet als {user.email} ·{' '}
          <button
            className="btn-ghost"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
            onClick={() => adminSignOut()}
          >
            Abmelden
          </button>
        </p>
      )}

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
          {polls.map((poll) => {
            const open = isPollOpen(poll)
            const autoExpired = isAutoExpired(poll)
            const closesAtDate = toDate(poll.closesAt)
            const questionCount = poll.questions?.length || 0
            const title = questionCount === 1 ? poll.questions[0].text : `${questionCount} Fragen`
            const baseUrl = window.location.origin
            const voteUrl = `${baseUrl}/vote/${poll.id}`
            const resultsUrl = `${baseUrl}/results/${poll.id}`
            const qrOpen = qrOpenId === poll.id

            return (
              <div className="card" key={poll.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ marginBottom: '0.4rem' }}>{title}</h3>
                  <span className={`pill ${open ? 'pill-ok' : ''}`}>
                    {open ? 'offen' : autoExpired ? 'automatisch geschlossen' : 'geschlossen'}
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', marginBottom: '0.75rem' }}>
                  {questionCount} {questionCount === 1 ? 'Frage' : 'Fragen'}
                  {closesAtDate && (
                    <>
                      {' · schließt automatisch am '}
                      {closesAtDate.toLocaleString('de-DE')}
                    </>
                  )}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link to={`/admin/poll/${poll.id}`} className="btn btn-primary">
                    Verwalten
                  </Link>
                  <Link to={`/results/${poll.id}`} className="btn-ghost">
                    Ergebnisse ansehen
                  </Link>
                  <button className="btn-ghost" onClick={() => setQrOpenId(qrOpen ? null : poll.id)}>
                    {qrOpen ? 'QR-Codes ausblenden' : 'QR-Codes anzeigen'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => handleDelete(poll)}
                    disabled={deletingId === poll.id}
                    style={{ color: 'var(--seal)', borderColor: 'var(--seal)' }}
                  >
                    {deletingId === poll.id ? 'Wird gelöscht …' : 'Löschen'}
                  </button>
                </div>

                {qrOpen && (
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <QrCode value={voteUrl} size={160} />
                      <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '0.4rem', marginBottom: 0 }}>Abstimmen</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <QrCode value={resultsUrl} size={160} />
                      <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '0.4rem', marginBottom: 0 }}>Auswertung</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

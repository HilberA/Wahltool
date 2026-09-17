import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPoll, subscribeToResults, closePoll, clearAutoClose } from '../services'
import { isPollOpen, isAutoExpired, toDate } from '../services/pollStatus'

function toCsv(poll, votes, total) {
  const rows = []
  poll.questions.forEach((question, qIndex) => {
    const counts = {}
    votes.forEach((v) => {
      const a = v.answers?.[qIndex]
      if (a != null) counts[a] = (counts[a] || 0) + 1
    })
    rows.push([`Frage ${qIndex + 1}: ${question.text}`])
    rows.push(['Option', 'Stimmen', 'Anteil'])
    question.options.forEach((option, oIndex) => {
      const c = counts[oIndex] || 0
      const pct = total > 0 ? ((c / total) * 100).toFixed(1) : '0.0'
      rows.push([option, String(c), `${pct}%`])
    })
    rows.push([])
  })
  rows.push(['Gesamtzahl Stimmzettel', String(total)])
  return rows.map((r) => r.map(escapeCsvCell).join(',')).join('\n')
}

function escapeCsvCell(cell) {
  if (cell == null) return ''
  const s = String(cell)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function QuestionResult({ question, votes, total }) {
  const counts = {}
  votes.forEach((v) => {
    const a = v.answers?.[question.qIndex]
    if (a != null) counts[a] = (counts[a] || 0) + 1
  })
  const maxCount = Math.max(1, ...question.options.map((_, i) => counts[i] || 0))

  return (
    <div className="card chart-card">
      <h3 style={{ marginBottom: '0.75rem' }}>{question.text}</h3>
      {question.options.map((option, i) => {
        const c = counts[i] || 0
        const pct = total > 0 ? Math.round((c / total) * 100) : 0
        return (
          <div className="bar-row" key={i}>
            <div className="bar-label">
              <span>{option}</span>
              <span>
                {c} · {pct}%
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(c / maxCount) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QuestionTable({ question, votes, total }) {
  const counts = {}
  votes.forEach((v) => {
    const a = v.answers?.[question.qIndex]
    if (a != null) counts[a] = (counts[a] || 0) + 1
  })
  return (
    <div className="print-only">
      <h4 style={{ marginBottom: '0.4rem' }}>{question.text}</h4>
      <table className="results-table" style={{ marginBottom: '1.5rem' }}>
        <thead>
          <tr>
            <th>Option</th>
            <th>Stimmen</th>
            <th>Anteil</th>
          </tr>
        </thead>
        <tbody>
          {question.options.map((option, i) => {
            const c = counts[i] || 0
            const pct = total > 0 ? Math.round((c / total) * 100) : 0
            return (
              <tr key={i}>
                <td>{option}</td>
                <td>{c}</td>
                <td>{pct}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Results() {
  const { pollId } = useParams()
  const [poll, setPoll] = useState(null)
  const [votes, setVotes] = useState([])
  const [error, setError] = useState(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    getPoll(pollId)
      .then((p) => {
        if (!p) setError('Diese Abstimmung wurde nicht gefunden.')
        else setPoll(p)
      })
      .catch(() => setError('Konnte Umfrage nicht laden.'))
  }, [pollId])

  useEffect(() => {
    if (!poll) return
    const unsubscribe = subscribeToResults(pollId, setVotes)
    return unsubscribe
  }, [poll, pollId])

  if (error) {
    return (
      <div className="card empty-state">
        <p>{error}</p>
      </div>
    )
  }

  if (!poll) {
    return <p>Lädt …</p>
  }

  const total = votes.length
  const open = isPollOpen(poll)
  const autoExpired = isAutoExpired(poll)
  const closesAtDate = toDate(poll.closesAt)
  const generatedAt = new Date().toLocaleString('de-DE')

  async function handleClose() {
    if (!confirm('Abstimmung wirklich beenden? Danach können keine weiteren Stimmen abgegeben werden.')) return
    setClosing(true)
    try {
      await closePoll(pollId)
      setPoll((p) => ({ ...p, status: 'closed' }))
    } catch (err) {
      console.error(err)
      alert('Beenden fehlgeschlagen: ' + (err.message || err.code || 'unbekannter Fehler'))
    } finally {
      setClosing(false)
    }
  }

  async function handleClearAutoClose() {
    if (!confirm('Automatischen Schließzeitpunkt entfernen? Die Abstimmung nimmt danach wieder Stimmen an (falls sie nicht manuell beendet wurde).')) return
    setClosing(true)
    try {
      await clearAutoClose(pollId)
      setPoll((p) => ({ ...p, closesAt: null }))
    } catch (err) {
      console.error(err)
      alert('Zurücksetzen fehlgeschlagen: ' + (err.message || err.code || 'unbekannter Fehler'))
    } finally {
      setClosing(false)
    }
  }

  return (
    <div>
      <div className="print-only" style={{ display: 'none', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
        Erstellt am {generatedAt}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2>Auswertung</h2>
        <span className={`pill ${open ? 'pill-ok' : ''}`}>
          {open ? 'offen' : autoExpired ? 'automatisch geschlossen' : 'geschlossen'}
        </span>
      </div>
      <p style={{ color: 'var(--ink-soft)' }}>
        {total} Stimmzettel bisher · aktualisiert live
        {closesAtDate && (
          <>
            {' · schließt automatisch am '}
            {closesAtDate.toLocaleString('de-DE')}
          </>
        )}
      </p>

      {poll.questions.map((question, qIndex) => (
        <QuestionResult key={qIndex} question={{ ...question, qIndex }} votes={votes} total={total} />
      ))}

      {poll.questions.map((question, qIndex) => (
        <QuestionTable key={qIndex} question={{ ...question, qIndex }} votes={votes} total={total} />
      ))}
      <p className="print-only" style={{ fontSize: '0.85rem' }}>
        <strong>Gesamtzahl Stimmzettel:</strong> {total}
      </p>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          onClick={() => downloadFile(`abstimmung-${pollId}.csv`, toCsv(poll, votes, total), 'text/csv;charset=utf-8')}
        >
          Als CSV exportieren
        </button>
        <button className="btn-ghost" onClick={() => window.print()}>
          Als PDF drucken
        </button>
        {poll.status === 'open' && (
          <button className="btn-ghost" onClick={handleClose} disabled={closing}>
            Abstimmung beenden
          </button>
        )}
        {poll.status === 'open' && closesAtDate && (
          <button className="btn-ghost" onClick={handleClearAutoClose} disabled={closing}>
            Automatischen Ablauf zurücksetzen
          </button>
        )}
      </div>
    </div>
  )
}

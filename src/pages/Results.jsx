import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPoll, subscribeToResults, closePoll } from '../services'
import { isPollOpen, isAutoExpired, toDate } from '../services/pollStatus'

function toCsv(poll, counts, total) {
  const rows = [['Option', 'Stimmen', 'Anteil']]
  poll.options.forEach((option, i) => {
    const c = counts[i] || 0
    const pct = total > 0 ? ((c / total) * 100).toFixed(1) : '0.0'
    rows.push([option, String(c), `${pct}%`])
  })
  rows.push([])
  rows.push(['Frage', poll.question])
  rows.push(['Gesamtstimmen', String(total)])
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

export default function Results() {
  const { pollId } = useParams()
  const [poll, setPoll] = useState(null)
  const [votes, setVotes] = useState([])
  const [error, setError] = useState(null)

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

  const counts = {}
  votes.forEach((v) => {
    counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1
  })
  const total = votes.length
  const maxCount = Math.max(1, ...poll.options.map((_, i) => counts[i] || 0))
  const open = isPollOpen(poll)
  const autoExpired = isAutoExpired(poll)
  const closesAtDate = toDate(poll.closesAt)
  const generatedAt = new Date().toLocaleString('de-DE')

  async function handleClose() {
    if (!confirm('Abstimmung wirklich beenden? Danach können keine weiteren Stimmen abgegeben werden.')) return
    await closePoll(pollId)
    setPoll((p) => ({ ...p, status: 'closed' }))
  }

  return (
    <div>
      <div className="print-only" style={{ display: 'none', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
        Erstellt am {generatedAt}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2>{poll.question}</h2>
        <span className={`pill ${open ? 'pill-ok' : ''}`}>
          {open ? 'offen' : autoExpired ? 'automatisch geschlossen' : 'geschlossen'}
        </span>
      </div>
      <p style={{ color: 'var(--ink-soft)' }}>
        {total} Stimme{total === 1 ? '' : 'n'} bisher · aktualisiert live
        {closesAtDate && (
          <>
            {' · schließt automatisch am '}
            {closesAtDate.toLocaleString('de-DE')}
          </>
        )}
      </p>

      <div className="card chart-card">
        {poll.options.map((option, i) => {
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

      <table className="print-only results-table">
        <thead>
          <tr>
            <th>Option</th>
            <th>Stimmen</th>
            <th>Anteil</th>
          </tr>
        </thead>
        <tbody>
          {poll.options.map((option, i) => {
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
          <tr>
            <td><strong>Gesamt</strong></td>
            <td><strong>{total}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          onClick={() => downloadFile(`abstimmung-${pollId}.csv`, toCsv(poll, counts, total), 'text/csv;charset=utf-8')}
        >
          Als CSV exportieren
        </button>
        <button className="btn-ghost" onClick={() => window.print()}>
          Als PDF drucken
        </button>
        {poll.status === 'open' && (
          <button className="btn-ghost" onClick={handleClose}>
            Abstimmung beenden
          </button>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPoll, getTokens, addTokens, updatePollContent } from '../services'
import { formatCodeForDisplay } from '../services/tokenUtils'
import { isPollOpen, isAutoExpired, toDate } from '../services/pollStatus'
import QrCode from '../components/QrCode'

function emptyQuestion() {
  return { text: '', options: ['', ''] }
}

export default function AdminPollDetail() {
  const { pollId } = useParams()
  const [poll, setPoll] = useState(null)
  const [error, setError] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [showAllCodes, setShowAllCodes] = useState(false)

  const [questions, setQuestions] = useState([emptyQuestion()])
  const [visibility, setVisibility] = useState('admin')
  const [closesAtInput, setClosesAtInput] = useState('')
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [addCount, setAddCount] = useState(10)
  const [addingCodes, setAddingCodes] = useState(false)

  useEffect(() => {
    getPoll(pollId)
      .then((p) => {
        if (!p) {
          setError('Diese Abstimmung wurde nicht gefunden.')
          return
        }
        setPoll(p)
        setQuestions(p.questions.map((q) => ({ text: q.text, options: [...q.options] })))
        setVisibility(p.resultsVisibility || 'admin')
        const closesAtDate = toDate(p.closesAt)
        setClosesAtInput(closesAtDate ? toLocalDatetimeInputValue(closesAtDate) : '')
      })
      .catch(() => setError('Konnte Umfrage nicht laden.'))
  }, [pollId])

  function loadTokens() {
    getTokens(pollId)
      .then((list) => {
        list.sort((a, b) => a.code.localeCompare(b.code))
        setTokens(list)
      })
      .catch((err) => {
        console.error(err)
        alert('Codes konnten nicht geladen werden.')
      })
  }

  function toggleShowCodes() {
    if (!showAllCodes && tokens === null) loadTokens()
    setShowAllCodes(!showAllCodes)
  }

  function updateQuestionText(qIndex, value) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, text: value } : q)))
  }
  function updateOption(qIndex, oIndex, value) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q))
    )
  }
  function addOption(qIndex) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)))
  }
  function removeOption(qIndex, oIndex) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q)))
  }
  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()])
  }
  function removeQuestion(qIndex) {
    setQuestions((prev) => prev.filter((_, i) => i !== qIndex))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError(null)
    setSaved(false)

    const cleanQuestions = questions
      .map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()).filter(Boolean) }))
      .filter((q) => q.text || q.options.length > 0)

    if (cleanQuestions.length === 0) {
      setSaveError('Bitte mindestens eine Frage eingeben.')
      return
    }
    for (const q of cleanQuestions) {
      if (!q.text) {
        setSaveError('Bitte bei jeder Frage einen Text eingeben.')
        return
      }
      if (q.options.length < 2) {
        setSaveError(`Bitte bei "${q.text}" mindestens zwei Antwortoptionen angeben.`)
        return
      }
    }
    let closesAt = null
    if (closesAtInput) {
      closesAt = new Date(closesAtInput)
    }

    setSaving(true)
    try {
      await updatePollContent(pollId, { questions: cleanQuestions, resultsVisibility: visibility, closesAt })
      setPoll((p) => ({ ...p, questions: cleanQuestions, resultsVisibility: visibility, closesAt: closesAt ? { toDate: () => closesAt } : null }))
      setSaved(true)
    } catch (err) {
      console.error(err)
      setSaveError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddTokens() {
    const count = Number(addCount)
    if (!count || count < 1 || count > 1000) return
    setAddingCodes(true)
    try {
      await addTokens(pollId, count)
      if (showAllCodes) loadTokens()
      alert(`${count} weitere Codes wurden erstellt.`)
    } catch (err) {
      console.error(err)
      alert('Codes konnten nicht erstellt werden.')
    } finally {
      setAddingCodes(false)
    }
  }

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

  const open = isPollOpen(poll)
  const autoExpired = isAutoExpired(poll)
  const baseUrl = window.location.origin
  const voteUrl = `${baseUrl}/vote/${pollId}`
  const resultsUrl = `${baseUrl}/results/${pollId}`
  const unusedCodes = tokens ? tokens.filter((t) => !t.used) : null
  const usedCount = tokens ? tokens.filter((t) => t.used).length : null

  return (
    <div>
      <Link to="/admin" className="btn-ghost" style={{ marginBottom: '1rem', display: 'inline-block' }}>
        ← Zur Übersicht
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2>Abstimmung verwalten</h2>
        <span className={`pill ${open ? 'pill-ok' : ''}`}>
          {open ? 'offen' : autoExpired ? 'automatisch geschlossen' : 'geschlossen'}
        </span>
      </div>

      <div className="card">
        <h3>Links &amp; QR-Codes</h3>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <QrCode value={voteUrl} size={160} />
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '0.4rem', marginBottom: 0 }}>Abstimmen</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <QrCode value={resultsUrl} size={160} />
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '0.4rem', marginBottom: 0 }}>Auswertung</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Codes</h3>
        {tokens && (
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            {tokens.length} Codes insgesamt · {usedCount} benutzt · {unusedCodes.length} noch offen
          </p>
        )}
        <button className="btn-ghost" onClick={toggleShowCodes} style={{ marginBottom: '1rem' }}>
          {showAllCodes ? 'Codes ausblenden' : 'Codes anzeigen'}
        </button>

        {showAllCodes && tokens && (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>Noch nicht verwendete Codes:</p>
            <div className="token-list">
              {unusedCodes.length > 0 ? unusedCodes.map((t) => formatCodeForDisplay(t.code)).join('\n') : '(alle Codes wurden bereits verwendet)'}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button
                className="btn-ghost"
                onClick={() => navigator.clipboard.writeText(unusedCodes.map((t) => formatCodeForDisplay(t.code)).join('\n'))}
              >
                Offene Codes kopieren
              </button>
              <button className="btn-ghost" onClick={() => window.print()}>
                Codes drucken
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', display: 'block', marginBottom: '0.4rem' }}>
            Weitere Codes generieren
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="number"
              min="1"
              max="1000"
              value={addCount}
              onChange={(e) => setAddCount(e.target.value)}
              style={{ width: '90px', padding: '0.5rem', border: '1px solid var(--line)', borderRadius: '3px' }}
            />
            <button className="btn-primary" onClick={handleAddTokens} disabled={addingCodes}>
              {addingCodes ? 'Wird erstellt …' : '+ Codes erstellen'}
            </button>
          </div>
        </div>
      </div>

      <form className="card" onSubmit={handleSave}>
        <h3>Fragen &amp; Optionen bearbeiten</h3>
        <div className="notice">
          Änderungen wirken sich auf die laufende/kommende Abstimmung aus. Bereits abgegebene
          Stimmen bleiben unverändert in der Datenbank – wenn du Fragen oder Optionen nach dem
          Start der Abstimmung änderst, können bestehende Auswertungen dadurch nicht mehr
          eindeutig zuordenbar sein. Am saubersten ist es, alles vor der ersten Stimmabgabe
          fertigzustellen.
        </div>

        {questions.map((question, qIndex) => (
          <div key={qIndex} style={{ borderTop: qIndex > 0 ? '1px solid var(--line)' : 'none', paddingTop: qIndex > 0 ? '1.25rem' : 0, marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>Frage {qIndex + 1}</label>
              {questions.length > 1 && (
                <button type="button" className="btn-ghost" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }} onClick={() => removeQuestion(qIndex)}>
                  Frage entfernen
                </button>
              )}
            </div>
            <div className="field">
              <input type="text" value={question.text} onChange={(e) => updateQuestionText(qIndex, e.target.value)} />
            </div>
            <div className="field">
              <label>Antwortoptionen</label>
              {question.options.map((option, oIndex) => (
                <div className="option-row" key={oIndex}>
                  <input type="text" value={option} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} />
                  {question.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(qIndex, oIndex)} aria-label="Option entfernen">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={() => addOption(qIndex)}>
                + Option hinzufügen
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn-ghost" onClick={addQuestion} style={{ marginBottom: '1.5rem' }}>
          + Weitere Frage hinzufügen
        </button>

        <div className="field">
          <label htmlFor="closesAt">Automatisch schließen am (optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              id="closesAt"
              type="datetime-local"
              value={closesAtInput}
              onChange={(e) => setClosesAtInput(e.target.value)}
              style={{ flex: 1 }}
            />
            {closesAtInput && (
              <button type="button" className="btn-ghost" onClick={() => setClosesAtInput('')}>
                Entfernen
              </button>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="visibility">Ergebnisse sichtbar für</label>
          <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="admin">Nur mich (Admin)</option>
            <option value="public">Jede:n mit dem Auswertungs-Link</option>
          </select>
        </div>

        {saveError && <div className="notice">{saveError}</div>}
        {saved && <p style={{ color: 'var(--ok)', fontSize: '0.9rem' }}>Gespeichert.</p>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? 'Wird gespeichert …' : 'Änderungen speichern'}
        </button>
      </form>

      <Link to={`/results/${pollId}`} className="btn-ghost">
        Zur Auswertung
      </Link>
    </div>
  )
}

function toLocalDatetimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

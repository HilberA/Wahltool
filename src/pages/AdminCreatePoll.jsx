import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPoll } from '../services'
import { formatCodeForDisplay } from '../services/tokenUtils'
import QrCode from '../components/QrCode'

export default function AdminCreatePoll() {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [tokenCount, setTokenCount] = useState(20)
  const [visibility, setVisibility] = useState('admin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  function updateOption(index, value) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  function addOption() {
    setOptions((prev) => [...prev, ''])
  }

  function removeOption(index) {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
    if (!question.trim()) {
      setError('Bitte eine Frage eingeben.')
      return
    }
    if (cleanOptions.length < 2) {
      setError('Bitte mindestens zwei Antwortoptionen angeben.')
      return
    }
    if (tokenCount < 1 || tokenCount > 2000) {
      setError('Die Teilnehmerzahl muss zwischen 1 und 2000 liegen.')
      return
    }

    setBusy(true)
    try {
      const { pollId, tokens } = await createPoll({
        question: question.trim(),
        options: cleanOptions,
        resultsVisibility: visibility,
        tokenCount: Number(tokenCount)
      })
      setResult({ pollId, tokens })
    } catch (err) {
      console.error(err)
      setError('Die Umfrage konnte nicht erstellt werden. Bitte erneut versuchen.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const baseUrl = window.location.origin
    const voteUrl = `${baseUrl}/vote/${result.pollId}`
    const resultsUrl = `${baseUrl}/results/${result.pollId}`
    const codesText = result.tokens.map(formatCodeForDisplay).join('\n')

    return (
      <div>
        <h2>Umfrage erstellt</h2>
        <div className="notice">
          Ein Link/QR-Code für alle – aber jede Person braucht ihren eigenen Code aus der Liste
          unten, um tatsächlich abstimmen zu können. Ein Code funktioniert nur einmal, egal auf
          welchem Gerät er eingegeben wird.
        </div>

        <div className="card">
          <h3>1. Link bzw. QR-Code auflegen</h3>
          <p>Diesen einen Link kannst du z. B. als QR-Code am Tisch platzieren. Alle öffnen dieselbe Seite.</p>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <QrCode value={voteUrl} />
            <div>
              <div className="token-list" style={{ maxHeight: 'none' }}>{voteUrl}</div>
              <button className="btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => navigator.clipboard.writeText(voteUrl)}>
                Link kopieren
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>2. Codes verteilen</h3>
          <p>
            {result.tokens.length} Codes – trenne sie ab (z. B. ausschneiden) und gib jeder Person genau
            einen. Wer kein eigenes Gerät hat, nennt ihre/seine Nummer einfach jemand anderem, der/die
            gerade abstimmt.
          </p>
          <div className="token-list">{codesText}</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button className="btn-ghost" onClick={() => navigator.clipboard.writeText(codesText)}>
              Codes kopieren
            </button>
            <button className="btn-ghost" onClick={() => window.print()}>
              Codes drucken
            </button>
          </div>
        </div>

        <div className="card">
          <h3>3. Auswertung</h3>
          <Link className="btn btn-primary" to={`/results/${result.pollId}`}>
            Zur Auswertung
          </Link>
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{resultsUrl}</p>
        </div>

        <Link to="/admin" className="btn-ghost">
          Zur Übersicht
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h2>Neue Abstimmung</h2>
      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="question">Frage</label>
          <input
            id="question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="z. B. Soll der Vereinsbeitrag angehoben werden?"
          />
        </div>

        <div className="field">
          <label>Antwortoptionen</label>
          {options.map((option, i) => (
            <div className="option-row" key={i}>
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} aria-label="Option entfernen">
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={addOption}>
            + Option hinzufügen
          </button>
        </div>

        <div className="field">
          <label htmlFor="tokenCount">Anzahl Codes (= max. Teilnehmerzahl)</label>
          <input
            id="tokenCount"
            type="number"
            min="1"
            max="2000"
            value={tokenCount}
            onChange={(e) => setTokenCount(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="visibility">Ergebnisse sichtbar für</label>
          <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="admin">Nur mich (Admin)</option>
            <option value="public">Jede:n mit dem Auswertungs-Link</option>
          </select>
        </div>

        {error && <div className="notice">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Wird erstellt …' : 'Abstimmung erstellen & Codes generieren'}
        </button>
      </form>
    </div>
  )
}

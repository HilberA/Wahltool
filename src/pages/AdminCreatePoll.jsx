import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPoll } from '../services'
import { formatCodeForDisplay } from '../services/tokenUtils'
import QrCode from '../components/QrCode'

function emptyQuestion() {
  return { text: '', options: ['', ''] }
}

export default function AdminCreatePoll() {
  const [questions, setQuestions] = useState([emptyQuestion()])
  const [tokenCount, setTokenCount] = useState(20)
  const [visibility, setVisibility] = useState('admin')
  const [closesAtInput, setClosesAtInput] = useState('') // datetime-local string, optional
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  function updateQuestionText(qIndex, value) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, text: value } : q)))
  }

  function updateOption(qIndex, oIndex, value) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) } : q
      )
    )
  }

  function addOption(qIndex) {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ''] } : q)))
  }

  function removeOption(qIndex, oIndex) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: q.options.filter((_, j) => j !== oIndex) } : q))
    )
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()])
  }

  function removeQuestion(qIndex) {
    setQuestions((prev) => prev.filter((_, i) => i !== qIndex))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const cleanQuestions = questions
      .map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()).filter(Boolean) }))
      .filter((q) => q.text || q.options.length > 0)

    if (cleanQuestions.length === 0) {
      setError('Bitte mindestens eine Frage eingeben.')
      return
    }
    for (const q of cleanQuestions) {
      if (!q.text) {
        setError('Bitte bei jeder Frage einen Text eingeben.')
        return
      }
      if (q.options.length < 2) {
        setError(`Bitte bei "${q.text}" mindestens zwei Antwortoptionen angeben.`)
        return
      }
    }
    if (tokenCount < 1 || tokenCount > 2000) {
      setError('Die Teilnehmerzahl muss zwischen 1 und 2000 liegen.')
      return
    }
    let closesAt = null
    if (closesAtInput) {
      closesAt = new Date(closesAtInput)
      if (closesAt <= new Date()) {
        setError('Der automatische Schließzeitpunkt muss in der Zukunft liegen.')
        return
      }
    }

    setBusy(true)
    try {
      const { pollId, tokens } = await createPoll({
        questions: cleanQuestions,
        resultsVisibility: visibility,
        tokenCount: Number(tokenCount),
        closesAt
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
          unten, um tatsächlich abstimmen zu können. Ein Code funktioniert nur einmal und deckt
          alle Fragen der Umfrage ab, egal auf welchem Gerät er eingegeben wird.
        </div>

        <div className="card">
          <h3>1. Link bzw. QR-Code zum Abstimmen auflegen</h3>
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
          <p>Auch dafür gibt es einen eigenen Link/QR-Code, z. B. um ihn live auf eine Leinwand zu projizieren.</p>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <QrCode value={resultsUrl} />
            <div>
              <div className="token-list" style={{ maxHeight: 'none' }}>{resultsUrl}</div>
              <Link className="btn btn-primary" style={{ marginTop: '0.75rem' }} to={`/results/${result.pollId}`}>
                Zur Auswertung
              </Link>
            </div>
          </div>
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
              <input
                type="text"
                value={question.text}
                onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                placeholder="z. B. Wer soll Vorsitzende:r werden?"
              />
            </div>

            <div className="field">
              <label>Antwortoptionen</label>
              {question.options.map((option, oIndex) => (
                <div className="option-row" key={oIndex}>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                  />
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
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '0.35rem', marginBottom: 0 }}>
            Leer lassen, wenn du die Abstimmung nur manuell über den Button "Beenden" schließen willst.
            Beides ist gleichzeitig möglich: Du kannst jederzeit vorzeitig manuell schließen, selbst wenn
            ein Zeitpunkt gesetzt ist. Hinweis: Der "Zurücksetzen"-Button im Datumswähler selbst ist ein
            iOS-Safari-Feature und funktioniert hier nicht zuverlässig – nutze stattdessen den
            "Entfernen"-Button daneben.
          </p>
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

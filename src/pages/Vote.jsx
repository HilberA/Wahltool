import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPoll, castVote } from '../services'
import { normalizeCodeInput } from '../services/tokenUtils'

// step: 'code' (Code eingeben) -> 'ballot' (auswählen) -> 'done' (bestätigt)
// Nach 'done' kann über "Nächste Person" wieder zu 'code' gesprungen werden,
// damit dasselbe Gerät direkt für die nächste Person genutzt werden kann.

export default function Vote() {
  const { pollId } = useParams()
  const [poll, setPoll] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [step, setStep] = useState('code')
  const [codeInput, setCodeInput] = useState('')
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('idle') // idle | submitting | error
  const [voteError, setVoteError] = useState(null)

  useEffect(() => {
    getPoll(pollId)
      .then((p) => {
        if (!p) {
          setLoadError('Diese Abstimmung wurde nicht gefunden.')
        } else if (p.status !== 'open') {
          setLoadError('Diese Abstimmung ist bereits beendet.')
        } else {
          setPoll(p)
        }
      })
      .catch(() => setLoadError('Die Abstimmung konnte nicht geladen werden.'))
  }, [pollId])

  function handleContinueFromCode(e) {
    e.preventDefault()
    if (normalizeCodeInput(codeInput).length < 4) {
      setVoteError('Bitte den vollständigen Code eingeben.')
      return
    }
    setVoteError(null)
    setStep('ballot')
  }

  async function handleSubmitVote() {
    if (selected === null) return
    setStatus('submitting')
    setVoteError(null)
    try {
      await castVote(pollId, normalizeCodeInput(codeInput), selected)
      setStep('done')
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      if (err.message === 'code-already-used') {
        setVoteError('Dieser Code wurde bereits verwendet. Falls das nicht du warst, wende dich an die Person, die die Abstimmung organisiert.')
      } else if (err.message === 'invalid-code') {
        setVoteError('Dieser Code ist ungültig. Bitte prüfen und erneut versuchen.')
      } else {
        setVoteError('Deine Stimme konnte nicht übermittelt werden. Bitte erneut versuchen.')
      }
    }
  }

  function handleNextPerson() {
    setCodeInput('')
    setSelected(null)
    setStatus('idle')
    setVoteError(null)
    setStep('code')
  }

  function handleBackToCode() {
    setVoteError(null)
    setStep('code')
  }

  if (loadError) {
    return (
      <div className="card empty-state">
        <p>{loadError}</p>
      </div>
    )
  }

  if (!poll) {
    return <p>Lädt …</p>
  }

  if (step === 'done') {
    return (
      <div className="card">
        <h2>Danke!</h2>
        <p>Deine Stimme wurde anonym gezählt. Dein Code ist jetzt ungültig.</p>
        <button className="btn-primary" onClick={handleNextPerson}>
          Nächste Person stimmt jetzt ab
        </button>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div>
        <h2>{poll.question}</h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          Gib deinen persönlichen Stimmzettel-Code ein, um abzustimmen.
        </p>
        <form className="card" onSubmit={handleContinueFromCode}>
          <div className="field">
            <label htmlFor="code">Dein Code</label>
            <input
              id="code"
              type="text"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="z. B. AB1-2CD"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              style={{ fontSize: '1.2rem', letterSpacing: '0.05em', textAlign: 'center' }}
            />
          </div>
          {voteError && <div className="notice">{voteError}</div>}
          <button className="btn-primary" type="submit">
            Weiter
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <h2>{poll.question}</h2>
      <p style={{ color: 'var(--ink-soft)' }}>Wähle eine Option. Deine Stimme wird anonym erfasst.</p>

      <div className="card">
        {poll.options.map((option, i) => (
          <label className={`ballot-choice ${selected === i ? 'selected' : ''}`} key={i}>
            <input type="radio" name="option" checked={selected === i} onChange={() => setSelected(i)} />
            {option}
          </label>
        ))}

        {voteError && <div className="notice">{voteError}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button
            className="btn-primary"
            disabled={selected === null || status === 'submitting'}
            onClick={handleSubmitVote}
          >
            {status === 'submitting' ? 'Wird gesendet …' : 'Stimme abgeben'}
          </button>
          {status !== 'submitting' && (
            <button className="btn-ghost" onClick={handleBackToCode}>
              Code korrigieren
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

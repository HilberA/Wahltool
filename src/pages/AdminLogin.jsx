import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { adminSignIn, adminSignUp } from '../lib/firebase'
import { useAdminUser } from '../hooks/useAdminUser'

export default function AdminLogin() {
  const user = useAdminUser()
  const location = useLocation()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (user) {
    const redirectTo = location.state?.from || '/admin'
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await adminSignIn(email.trim(), password)
      } else {
        await adminSignUp(email.trim(), password)
      }
    } catch (err) {
      setError(mapAuthError(err.code))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>{mode === 'signin' ? 'Admin-Login' : 'Admin-Konto erstellen'}</h2>
      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input id="email" type="text" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <div className="notice">{error}</div>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Bitte warten …' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </form>

      <button className="btn-ghost" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? 'Noch kein Konto? Jetzt erstellen' : 'Schon ein Konto? Anmelden'}
      </button>
    </div>
  )
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Ungültige E-Mail-Adresse.'
    case 'auth/email-already-in-use':
      return 'Für diese E-Mail existiert bereits ein Konto – bitte anmelden statt registrieren.'
    case 'auth/weak-password':
      return 'Das Passwort muss mindestens 6 Zeichen haben.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-Mail oder Passwort ist falsch.'
    default:
      return 'Etwas ist schiefgelaufen. Bitte erneut versuchen.'
  }
}

// Zentrale Stelle für die Frage "ist diese Umfrage gerade offen?", damit
// Vote.jsx, Results.jsx und AdminDashboard.jsx sich nicht widersprechen können.
// Eine Umfrage ist offen, wenn status === 'open' UND (kein Ablaufzeitpunkt gesetzt
// ist ODER dieser noch nicht erreicht wurde).

export function isPollOpen(poll) {
  if (!poll) return false
  if (poll.status !== 'open') return false
  const closesAt = toDate(poll.closesAt)
  if (closesAt && closesAt.getTime() <= Date.now()) return false
  return true
}

// true nur, wenn die Umfrage NICHT mehr manuell geschlossen wurde, aber ihr
// gesetzter Ablaufzeitpunkt bereits erreicht ist (nützlich für die Anzeige
// "automatisch geschlossen" vs. "von dir beendet").
export function isAutoExpired(poll) {
  if (!poll || poll.status !== 'open') return false
  const closesAt = toDate(poll.closesAt)
  return Boolean(closesAt && closesAt.getTime() <= Date.now())
}

export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  return null
}

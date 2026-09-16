// Erzeugt kryptografisch zufällige, URL-taugliche Einmal-Tokens.
// Diese Datei hat keine Firebase-Abhängigkeit und muss bei einem Backend-Wechsel
// nicht angefasst werden.

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // ohne verwechselbare Zeichen (l, o, 0, 1)

// Kürzer als zuvor (6 statt 12 Zeichen), weil die Codes jetzt von Hand auf einer
// gemeinsamen Seite eingetippt werden statt Teil einer URL zu sein. 32^6 ≈ 1,07
// Milliarden mögliche Codes pro Umfrage – für Gruppengrößen bis mehrere Tausend
// bleibt die Kollisionswahrscheinlichkeit vernachlässigbar, zumal generateTokens()
// zusätzlich auf Eindeutigkeit innerhalb der Umfrage prüft.
export function generateToken(length = 6) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let token = ''
  for (let i = 0; i < length; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return token
}

export function generateTokens(count, length = 6) {
  const tokens = new Set()
  while (tokens.size < count) {
    tokens.add(generateToken(length))
  }
  return Array.from(tokens)
}

// Rein kosmetisch für den Ausdruck/die Anzeige: "ab12cd" -> "AB1-2CD"
export function formatCodeForDisplay(token) {
  const upper = token.toUpperCase()
  const mid = Math.ceil(upper.length / 2)
  return `${upper.slice(0, mid)}-${upper.slice(mid)}`
}

// Macht eine Nutzereingabe robust gegen Groß-/Kleinschreibung, Leerzeichen und
// den kosmetischen Bindestrich aus formatCodeForDisplay().
export function normalizeCodeInput(input) {
  return input.trim().toLowerCase().replace(/[\s-]/g, '')
}

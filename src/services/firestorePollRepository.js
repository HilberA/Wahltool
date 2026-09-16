// Konkrete Firestore-Implementierung des "PollRepository".
// Die UI-Seiten (src/pages/*) kennen diese Datei nicht direkt, sondern importieren
// nur aus src/services/index.js. Ein Wechsel auf einen eigenen Server bedeutet:
// diese Datei durch z.B. src/services/httpPollRepository.js ersetzen, mit
// identischer Funktionssignatur – der Rest der App bleibt unverändert.

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db, ensureAdminSession } from '../lib/firebase'
import { generateTokens } from './tokenUtils'

const pollsCol = collection(db, 'polls')

export async function createPoll({ question, options, resultsVisibility = 'admin', tokenCount }) {
  const admin = await ensureAdminSession()

  const pollRef = await addDoc(pollsCol, {
    question,
    options,
    status: 'open',
    resultsVisibility, // 'admin' | 'public'
    ownerUid: admin.uid,
    createdAt: serverTimestamp()
  })

  const tokens = generateTokens(tokenCount)
  const batch = writeBatch(db)
  const tokensCol = collection(db, 'polls', pollRef.id, 'tokens')
  tokens.forEach((token) => {
    batch.set(doc(tokensCol, token), { used: false, createdAt: serverTimestamp() })
  })
  await batch.commit()

  return { pollId: pollRef.id, tokens }
}

export async function listMyPolls() {
  const admin = await ensureAdminSession()
  const q = query(pollsCol, where('ownerUid', '==', admin.uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getPoll(pollId) {
  const snap = await getDoc(doc(db, 'polls', pollId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function closePoll(pollId) {
  await ensureAdminSession()
  await updateDoc(doc(db, 'polls', pollId), { status: 'closed' })
}

export async function setResultsVisibility(pollId, visibility) {
  await ensureAdminSession()
  await updateDoc(doc(db, 'polls', pollId), { resultsVisibility: visibility })
}

// Kernstück der Anonymität: In EINER Transaktion wird
//   1. der Code als "benutzt" markiert (ohne die abgegebene Stimme zu referenzieren),
//   2. die Stimme als komplett eigenständiges Dokument angelegt.
// Es gibt in der Datenbank keine Spalte/Feld, das Code und Stimme miteinander verknüpft.
//
// Bewusst KEIN vorheriges tx.get(tokenRef): Abstimmende sind nicht die Admin-Person
// (keine Leserechte auf die Code-Liste, siehe firestore.rules) und dürfen die
// Code-Liste auch nicht einsehen können – sonst ließe sich durchprobieren, welche
// Codes noch gültig sind. Die Prüfung "existiert der Code, ist er noch unbenutzt"
// läuft stattdessen ausschließlich über die Schreib-Regel für tokens/{tokenId}
// (resource.data.used == false). Firestore lehnt den update()-Teil der Transaktion
// ab, wenn der Code nicht existiert (not-found) oder schon benutzt wurde
// (permission-denied) – beides fangen wir hier anhand des Fehlercodes ab.
export async function castVote(pollId, rawCode, optionIndex) {
  const tokenRef = doc(db, 'polls', pollId, 'tokens', rawCode)
  const voteRef = doc(collection(db, 'polls', pollId, 'votes'))

  try {
    await runTransaction(db, async (tx) => {
      tx.update(tokenRef, { used: true, usedAt: serverTimestamp() })
      tx.set(voteRef, { optionIndex, createdAt: serverTimestamp() })
    })
  } catch (err) {
    if (err.code === 'not-found') {
      throw new Error('invalid-code')
    }
    if (err.code === 'permission-denied' || err.code === 'failed-precondition') {
      throw new Error('code-already-used')
    }
    throw err
  }
}

export function subscribeToResults(pollId, callback) {
  const votesCol = collection(db, 'polls', pollId, 'votes')
  return onSnapshot(votesCol, (snap) => {
    const votes = snap.docs.map((d) => d.data())
    callback(votes)
  })
}

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
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  Timestamp
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { generateTokens } from './tokenUtils'

const pollsCol = collection(db, 'polls')

function requireCurrentUser() {
  const user = auth.currentUser
  if (!user) throw new Error('not-authenticated')
  return user
}

export async function createPoll({ question, options, resultsVisibility = 'admin', tokenCount, closesAt = null }) {
  const admin = requireCurrentUser()

  const pollRef = await addDoc(pollsCol, {
    question,
    options,
    status: 'open',
    resultsVisibility, // 'admin' | 'public'
    closesAt: closesAt ? Timestamp.fromDate(closesAt) : null,
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
  const admin = requireCurrentUser()
  // Bewusst OHNE orderBy() in der Firestore-Abfrage: die Kombination aus
  // where(ownerUid) + orderBy(createdAt) würde einen zusammengesetzten Index
  // verlangen, den man in der Firebase-Konsole manuell anlegen müsste. Stattdessen
  // wird hier im Browser sortiert – bei der überschaubaren Anzahl an Umfragen einer
  // kleinen Gruppe macht das keinen spürbaren Unterschied.
  const q = query(pollsCol, where('ownerUid', '==', admin.uid))
  const snap = await getDocs(q)
  const polls = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  polls.sort((a, b) => {
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
    return bTime - aTime
  })
  return polls
}

export async function getPoll(pollId) {
  const snap = await getDoc(doc(db, 'polls', pollId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function closePoll(pollId) {
  requireCurrentUser()
  await updateDoc(doc(db, 'polls', pollId), { status: 'closed' })
}

export async function reopenPoll(pollId) {
  requireCurrentUser()
  await updateDoc(doc(db, 'polls', pollId), { status: 'open' })
}

export async function setResultsVisibility(pollId, visibility) {
  requireCurrentUser()
  await updateDoc(doc(db, 'polls', pollId), { resultsVisibility: visibility })
}

async function deleteSubcollection(pollId, name) {
  const colRef = collection(db, 'polls', pollId, name)
  const snap = await getDocs(colRef)
  const docs = snap.docs
  const chunkSize = 450 // unter dem Firestore-Batch-Limit von 500
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize)
    const batch = writeBatch(db)
    chunk.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

// Löscht eine Umfrage vollständig: erst die Codes und Stimmen (Unterkollektionen),
// dann das Umfrage-Dokument selbst. Firestore löscht Unterkollektionen NICHT
// automatisch mit, deshalb die explizite Reihenfolge.
export async function deletePoll(pollId) {
  requireCurrentUser()
  await deleteSubcollection(pollId, 'tokens')
  await deleteSubcollection(pollId, 'votes')
  await deleteDoc(doc(db, 'polls', pollId))
}

// Kernstück der Anonymität: In EINER Transaktion wird
//   1. der Code als "benutzt" markiert (ohne die abgegebene Stimme zu referenzieren),
//   2. die Stimme als komplett eigenständiges Dokument angelegt.
// Es gibt in der Datenbank keine Spalte/Feld, das Code und Stimme miteinander verknüpft.
//
// Bewusst KEIN vorheriges tx.get(tokenRef): Abstimmende sind nicht die Admin-Person
// (keine Leserechte auf die Code-Liste, siehe firestore.rules) und dürfen die
// Code-Liste auch nicht einsehen können – sonst ließe sich durchprobieren, welche
// Codes noch gültig sind. Die Prüfung "existiert der Code, ist er noch unbenutzt,
// ist die Umfrage noch offen (manuell UND per Ablaufzeitpunkt)" läuft stattdessen
// ausschließlich über die Schreib-Regel für tokens/{tokenId} in firestore.rules.
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

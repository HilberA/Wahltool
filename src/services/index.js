// Alle Seiten importieren AUSSCHLIESSLICH von hier, nie direkt aus
// firestorePollRepository.js. Beim Wechsel auf einen eigenen Server:
// eine neue Datei (z.B. httpPollRepository.js) mit denselben Funktionsnamen
// schreiben und hier den Export umbiegen. Der Rest der App ändert sich nicht.

export {
  createPoll,
  listMyPolls,
  getPoll,
  closePoll,
  deletePoll,
  clearAutoClose,
  setResultsVisibility,
  castVote,
  subscribeToResults
} from './firestorePollRepository'

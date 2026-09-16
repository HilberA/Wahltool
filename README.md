# Abstimmungstool

PWA für anonyme Abstimmungen in geschlossenen Gruppen (Verein, Team). Admin erstellt eine
Umfrage, generiert Einmal-Links für jede teilnehmende Person, die Auswertung läuft live und
lässt sich als CSV exportieren.

## Setup

1. **Firebase-Projekt anlegen** (eigenständig, siehe Begründung im Chat-Verlauf):
   - [Firebase Console](https://console.firebase.google.com) → "Projekt hinzufügen"
   - Firestore aktivieren (Produktionsmodus)
   - Authentication → Sign-in-Methode → "Anonym" aktivieren
   - Projekteinstellungen → "Meine Apps" → Web-App hinzufügen → Config-Werte kopieren

2. **Umgebungsvariablen**
   ```bash
   cp .env.example .env
   # .env mit den Werten aus der Firebase Console füllen
   ```

3. **Abhängigkeiten installieren & starten**
   ```bash
   npm install
   npm run dev
   ```

4. **Security Rules deployen** (wichtig, sonst greift die Anonymitäts-/Zugriffslogik nicht):
   ```bash
   npm install -g firebase-tools   # falls noch nicht vorhanden
   firebase login
   firebase init firestore         # bestehendes Projekt auswählen, firestore.rules übernehmen
   firebase deploy --only firestore:rules
   ```

5. **App-Icons ergänzen**: `public/icon-192.png` und `public/icon-512.png` durch echte Icons
   ersetzen (aktuell nicht enthalten), sonst funktioniert die "Installierbarkeit" der PWA nicht
   vollständig.

6. **Deployment**: `npm run build` erzeugt `dist/`, das z.B. auf Firebase Hosting, Vercel oder
   Netlify deployt werden kann.

## Wie die Abstimmung abläuft (ein Link für alle + individuelle Codes)

- Es gibt **einen gemeinsamen Link/QR-Code** pro Umfrage (`/vote/{pollId}`), der z. B. am
  Tisch ausgelegt werden kann. Jede Person öffnet dieselbe Seite.
- Zusätzlich werden beim Erstellen N Einmal-**Codes** generiert (kryptografisch zufällig,
  `src/services/tokenUtils.js`, 6 Zeichen, z. B. `AB1-2CD`) und als eigene Dokumente in
  `polls/{id}/tokens` gespeichert. Diese Codes werden **physisch verteilt** (ausdrucken,
  zerschneiden, verteilen) – nicht als Teil einer URL.
- Auf der gemeinsamen Seite gibt jede Person zuerst ihren Code ein, dann ihre Stimme. Wer kein
  eigenes Gerät hat, nennt den Code einfach jemand anderem – derselbe Bildschirm kann beliebig
  oft für unterschiedliche Personen genutzt werden, entscheidend ist nur der Code, nicht das
  Gerät.
- `castVote()` in `src/services/firestorePollRepository.js` markiert in **einer
  Firestore-Transaktion** den Code als "benutzt" und legt die Stimme als komplett separates
  Dokument in `polls/{id}/votes` an – **ohne** Verweis auf den Code oder eine Identität.
  Niemand (auch nicht der Admin) kann aus der Datenbank ablesen, wer wie abgestimmt hat.
- `firestore.rules` erzwingt das serverseitig: ein Code darf genau einmal von "unbenutzt" auf
  "benutzt" wechseln, ein Stimmen-Dokument darf nur `optionIndex` und `createdAt` enthalten.
  Bewusst **kein** Leserecht auf die Code-Liste für Abstimmende (nur für die Admin-Person) –
  sonst ließe sich durchprobieren, welche Codes noch gültig sind. Die "ist der Code schon
  benutzt"-Prüfung läuft deshalb ausschließlich über die Schreib-Regel, nicht über ein
  vorheriges Lesen des Dokuments.

## Migrationsfreundliche Struktur

Die App kennt Firebase nur an zwei Stellen:
- `src/lib/firebase.js` – Initialisierung
- `src/services/firestorePollRepository.js` – die eigentlichen Datenbank-Operationen

Alle Seiten (`src/pages/*`) importieren ausschließlich aus `src/services/index.js`. Für einen
späteren Wechsel auf einen eigenen Server: eine neue Datei (z.B. `httpPollRepository.js`) mit
identischen Funktionsnamen (`createPoll`, `castVote`, `subscribeToResults`, …) schreiben und in
`src/services/index.js` den Export umbiegen. Die UI muss dafür nicht verändert werden.

Firestore-Daten lassen sich jederzeit über die `gcloud` CLI oder das Firebase Admin SDK als
JSON exportieren und in eine andere Datenbank importieren – bei der hier verwendeten, bewusst
simplen Datenstruktur (Polls, Tokens, Votes) ist das kein großer Aufwand.

## Grenzen dieses Grundgerüsts (MVP)

- **Admin-Zugriff ist ans Browser-Profil gebunden**: Es gibt aktuell kein Admin-Login mit
  Passwort, sondern anonyme Firebase-Auth. Wer die Übersicht `/admin` auf einem anderen Gerät
  sehen will, braucht eine echte Anmeldung (E-Mail/Passwort oder Google-Login lässt sich in
  `src/lib/firebase.js` ergänzen, ohne den Rest der App zu ändern).
- **Kein Schutz gegen Weitergabe von Codes**: Wenn eine Person ihren Code weitergibt, kann eine
  andere Person damit abstimmen. Für eine kleine, vertrauenswürdige Gruppe ist das meist
  akzeptabel und sogar gewollt (Person ohne eigenes Gerät nennt ihren Code); für höhere
  Anforderungen wäre eine serverseitige Cloud Function mit strikterer Validierung (z. B.
  Rate-Limiting pro IP) der nächste Schritt.
- **Kein Rate-Limiting auf Code-Eingaben**: Da Abstimmende keine Leserechte auf die Code-Liste
  haben, lässt sich ein einzelner Code nicht gezielt erraten, aber es gibt aktuell keinen
  eingebauten Schutz gegen automatisiertes Durchprobieren vieler Codes. Für eine kleine,
  vertrauenswürdige Gruppe ist das kein praktisches Risiko (6-stellige Codes, 32^6
  Kombinationen); bei größerer/öffentlicherer Nutzung würde man Firebase App Check und/oder
  eine Cloud Function mit Rate-Limiting ergänzen.
- **Keine Icons enthalten**: siehe Setup-Schritt 5.
- **Kein Umgang mit Mehrfachauswahl-Fragen (Checkbox statt Radio)**: aktuell nur
  Single-Choice-Abstimmungen.

## Projektstruktur

```
src/
  lib/firebase.js              Firebase-Init (einziger SDK-Import)
  services/
    tokenUtils.js               Token-Generierung (kein Firebase)
    firestorePollRepository.js  Firestore-Implementierung
    index.js                    Aktiver Export ("Migrations-Schalter")
  components/
    QrCode.jsx                   QR-Code für den gemeinsamen Abstimmungs-Link
  pages/
    AdminDashboard.jsx          Übersicht eigener Umfragen
    AdminCreatePoll.jsx         Umfrage erstellen + Link/QR-Code + Codeliste generieren
    Vote.jsx                    Öffentliche Stimmabgabe-Seite (Code-Eingabe + Ballot)
    Results.jsx                 Live-Auswertung + CSV/PDF-Export
  App.jsx                       Routing
firestore.rules                 Server-seitige Zugriffs-/Anonymitätslogik
```

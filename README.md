# Abstimmungstool

PWA für anonyme Abstimmungen in geschlossenen Gruppen (Verein, Team). Admin erstellt eine
Umfrage, es gibt einen gemeinsamen Link/QR-Code plus individuelle Einmal-Codes zum Verteilen,
die Auswertung läuft live und lässt sich als CSV oder PDF exportieren.

## Setup

1. **Firebase-Projekt anlegen**:
   - [Firebase Console](https://console.firebase.google.com) → "Projekt hinzufügen"
   - Firestore aktivieren (Produktionsmodus)
   - Authentication → Sign-in-Methode → **"E-Mail/Passwort"** aktivieren (nicht "Anonym")
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

4. **Security Rules veröffentlichen** (wichtig, sonst funktioniert weder Abstimmen noch
   Löschen): Inhalt von `firestore.rules` in der Firebase-Konsole unter
   **Firestore Database → Regeln** einfügen und veröffentlichen. Alternativ per CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # bestehendes Projekt auswählen, firestore.rules übernehmen
   firebase deploy --only firestore:rules
   ```

5. **Erstes Admin-Konto anlegen**: Beim ersten Aufruf von `/admin` landet ihr auf der
   Login-Seite. Dort auf "Noch kein Konto? Jetzt erstellen" klicken und ein Konto
   (E-Mail/Passwort) anlegen. Dieses Konto funktioniert dann auf jedem Gerät/Browser
   gleichermaßen.

6. **Domain freigeben**: Jede Domain, von der aus die App aufgerufen wird (lokale
   Entwicklungsumgebung, Codespaces, die Netlify-Domain, eine eigene Domain), muss in der
   Firebase Console unter **Authentication → Settings → Authorized domains** eingetragen sein
   – sonst schlägt der Login dort fehl.

7. **Deployment**: `npm run build` erzeugt `dist/`, das z. B. auf Netlify deployt werden kann
   (Build command `npm run build`, Publish directory `dist`). Nicht vergessen: die
   Umgebungsvariablen aus `.env` auch bei Netlify unter "Environment variables" eintragen,
   und die `public/_redirects`-Datei (Inhalt: `/*  /index.html  200`) sorgt dafür, dass Routen
   wie `/vote/abc` beim direkten Aufruf funktionieren.

## App Check aktivieren (optional, empfohlen für den Dauerbetrieb)

Schützt gegen automatisiertes Durchprobieren von Codes. Ohne diesen Schritt läuft die App
normal weiter, nur ohne diesen Zusatzschutz.

1. Firebase Console → **App Check** → eure Web-App auswählen → **reCAPTCHA v3** als Anbieter
   registrieren (führt zu einer kurzen Einrichtung bei Google reCAPTCHA, liefert einen
   "Site Key")
2. Diesen Site Key als `VITE_RECAPTCHA_SITE_KEY` in `.env` (lokal) und bei Netlify unter
   "Environment variables" eintragen
3. Neu deployen
4. Erst wenn ihr in der App Check-Übersicht seht, dass echte Anfragen ankommen: in der
   Firebase Console bei Firestore auf **"Erzwingen"** umstellen (App Check → Firestore →
   Enforce). Vorher testen, sonst sperrt ihr euch selbst aus.

## Wie die Abstimmung abläuft (ein Link für alle + individuelle Codes)

- Es gibt **einen gemeinsamen Link/QR-Code** pro Umfrage (`/vote/{pollId}`), der z. B. am
  Tisch ausgelegt werden kann. Jede Person öffnet dieselbe Seite.
- Zusätzlich werden beim Erstellen N Einmal-**Codes** generiert (kryptografisch zufällig,
  `src/services/tokenUtils.js`, 6 Zeichen, z. B. `AB1-2CD`) und als eigene Dokumente in
  `polls/{id}/tokens` gespeichert. Diese Codes werden **physisch verteilt** (ausdrucken,
  zerschneiden, verteilen) – nicht als Teil einer URL.
- Auf der gemeinsamen Seite gibt jede Person zuerst ihren Code ein, dann ihre Stimme. Wer kein
  eigenes Gerät hat, nennt den Code einfach jemand anderem – derselbe Bildschirm kann beliebig
  oft für unterschiedliche Personen genutzt werden.
- `castVote()` in `src/services/firestorePollRepository.js` markiert in **einer
  Firestore-Transaktion** den Code als "benutzt" und legt die Stimme als komplett separates
  Dokument in `polls/{id}/votes` an – **ohne** Verweis auf den Code oder eine Identität.
- `firestore.rules` erzwingt das serverseitig: ein Code darf genau einmal von "unbenutzt" auf
  "benutzt" wechseln, nur solange die Umfrage offen ist (manuell **und** per automatischem
  Ablaufzeitpunkt), und ein Stimmen-Dokument darf nur `optionIndex` und `createdAt` enthalten.
  Bewusst kein Leserecht auf die Code-Liste für Abstimmende – sonst ließe sich durchprobieren,
  welche Codes noch gültig sind.

## Umfrage automatisch UND manuell schließen

Beim Erstellen kann optional ein Zeitpunkt gesetzt werden ("Automatisch schließen am"). Ist er
gesetzt, gilt die Umfrage ab diesem Zeitpunkt überall als geschlossen (Stimmabgabe, Anzeige in
Übersicht/Auswertung) – geprüft sowohl im Frontend (`src/services/pollStatus.js`) als auch
serverseitig in den Security Rules. Unabhängig davon steht jederzeit zusätzlich der Button
**"Abstimmung beenden"** in der Auswertung zur Verfügung, um früher oder ganz ohne gesetzten
Zeitpunkt manuell zu schließen.

## Umfragen löschen

Im Admin-Dashboard hat jede Umfrage einen "Löschen"-Button. Das entfernt das Umfrage-Dokument
sowie alle zugehörigen Codes und Stimmen unwiderruflich (`deletePoll()` in
`firestorePollRepository.js`).

## Mehrere Fragen pro Abstimmung

Eine Umfrage kann mehrere Fragen enthalten (z. B. mehrere zu besetzende Positionen bei einer
Wahl), jede mit eigenen Antwortoptionen. `poll.questions` ist ein Array von
`{ text, options }`. Eine Person meldet sich **einmal** mit ihrem Code an und beantwortet dabei
alle Fragen der Umfrage in einem Stimmzettel; `castVote()` schreibt ein einziges
Stimmzettel-Dokument mit einem `answers`-Array (ein Options-Index pro Frage, an derselben
Position wie in `poll.questions`) – weiterhin ohne jeden Verweis auf den Code.

## QR-Codes

Sowohl der Abstimmungs-Link (`/vote/{pollId}`) als auch der Auswertungs-Link
(`/results/{pollId}`) haben einen eigenen QR-Code. Direkt nach dem Erstellen werden beide
angezeigt; im Admin-Dashboard lässt sich über "QR-Codes anzeigen" bei jeder laufenden Umfrage
jederzeit erneut auf beide zugreifen (z. B. um sie später nochmal zu projizieren oder
auszudrucken).

## Migrationsfreundliche Struktur

Die App kennt Firebase nur an zwei Stellen:
- `src/lib/firebase.js` – Initialisierung, Login
- `src/services/firestorePollRepository.js` – die eigentlichen Datenbank-Operationen

Alle Seiten (`src/pages/*`) importieren ausschließlich aus `src/services/index.js`. Für einen
späteren Wechsel auf einen eigenen Server: eine neue Datei (z. B. `httpPollRepository.js`) mit
identischen Funktionsnamen schreiben und in `src/services/index.js` den Export umbiegen. Die UI
muss dafür nicht verändert werden.

## Grenzen dieses Grundgerüsts

- **Kein Schutz gegen Weitergabe von Codes**: Wenn eine Person ihren Code weitergibt, kann eine
  andere Person damit abstimmen. Für eine kleine, vertrauenswürdige Gruppe ist das meist
  akzeptabel und sogar gewollt (Person ohne eigenes Gerät nennt ihren Code).
- **Pro Frage nur eine Antwort (Single-Choice)**: keine Mehrfachauswahl (Checkboxen) innerhalb
  einer einzelnen Frage. Mehrere *Fragen* pro Umfrage sind hingegen möglich (siehe oben).
- **Admin-Konten sind nicht gegenseitig sichtbar**: Jedes Konto sieht nur seine eigenen
  Umfragen. Für ein Team mit mehreren Admin-Personen auf einem gemeinsamen Konto: einfach
  dieselben Login-Daten teilen (kein technisches Mehrbenutzer-Konzept eingebaut).

## Projektstruktur

```
src/
  lib/firebase.js              Firebase-Init, Login (einziger direkter SDK-Import)
  hooks/useAdminUser.js         Login-Status als React-Hook
  services/
    tokenUtils.js               Code-Generierung (kein Firebase)
    pollStatus.js                "Ist die Umfrage offen?" (manuell + automatischer Ablauf)
    firestorePollRepository.js  Firestore-Implementierung
    index.js                    Aktiver Export ("Migrations-Schalter")
  components/
    QrCode.jsx                   QR-Code für den gemeinsamen Abstimmungs-Link
  pages/
    AdminLogin.jsx               Admin-Login / Konto erstellen
    AdminDashboard.jsx          Übersicht eigener Umfragen, Löschen
    AdminCreatePoll.jsx         Umfrage erstellen + Link/QR-Code + Codeliste, Ablaufzeitpunkt
    Vote.jsx                    Öffentliche Stimmabgabe-Seite (Code-Eingabe + Ballot)
    Results.jsx                 Live-Auswertung + CSV/PDF-Export
  App.jsx                       Routing, Login-Schutz für /admin
firestore.rules                 Server-seitige Zugriffs-, Anonymitäts- und Ablauflogik
public/icon-192.png, icon-512.png   PWA-Icons
```

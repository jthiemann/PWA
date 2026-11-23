# Persönlicher Adventskalender (verschlüsselte PWA)

Eine mobile-first Web-App als persönlicher Adventskalender: 24 Türchen mit
Rätseln, zwei Hinweisen und Lösung, Schnee-Effekt, Offline-Modus und
Installation auf dem iPhone-Homescreen. Kein Build-Step, reines HTML/CSS/JS.

**Datenschutz:** Das Repository kann öffentlich sein – veröffentlicht werden
ausschließlich **verschlüsselte** Inhalte (`secure/`). Texte und Bilder sind
ohne Passphrase nicht lesbar. Die unverschlüsselten Originale (`content.js`,
`images/`, `.passphrase`, `.salt`) bleiben lokal und sind per `.gitignore`
ausgeschlossen.

## Projektstruktur

```
.
├── index.html            App-Gerüst + Entsperr-Bildschirm
├── style.css             Festliches Design, responsive, iOS-kompatibel
├── app.js                Entschlüsselung, Datumsprüfung, Routing, Schnee
├── encrypt.mjs           Verschlüsselungs-Tool (Node.js)
├── manifest.json         PWA-Manifest (generische Bezeichnung)
├── sw.js                 Service Worker (Offline-Cache)
├── secure/               ★ wird veröffentlicht (nur Ciphertext)
│   ├── meta.json         öffentliche KDF-Parameter (Salt, IV, Iterationen)
│   ├── meta.enc          verschlüsselte Texte/Konfiguration
│   └── img/*.bin         verschlüsselte Bilder (Foto + 24 Türchen)
├── content.js            ★ lokale Quelle: Texte & Einstellungen (gitignored)
├── images/               ★ lokale Quelle: Fotos (gitignored, README bleibt)
├── .passphrase           ★ lokale Passphrase (gitignored)
├── .salt                 ★ lokaler Salt (gitignored)
├── icons/                App-Icons
└── README.md
```

## Voraussetzungen

- [Node.js](https://nodejs.org) 18 oder neuer (nur zum Verschlüsseln).
- Ein moderner Browser (iOS Safari ab 15.4 empfohlen).

## Erste Einrichtung

1. Inhalte in `content.js` anpassen und eigene Fotos in `images/` ablegen
   (siehe unten).
2. Passphrase setzen bzw. prüfen: Sie steht in der Datei **`.passphrase`**.
   Zum Ändern die Datei bearbeiten oder das Tool mit Argument aufrufen:
   ```powershell
   node encrypt.mjs "DEINE-NEUE-PASSPHRASE"
   ```
   > Die Passphrase ist der einzige Schlüssel zu den Inhalten. Sicher aufbewahren
   > (Passwortmanager). Bei Verlust sind die verschlüsselten Daten nicht mehr
   > lesbar – es gibt bewusst keine Wiederherstellung.
3. Verschlüsseln:
   ```powershell
   node encrypt.mjs
   ```
   Das erzeugt/aktualisiert `secure/` (Meta-Daten + 25 Bilddateien).
4. Lokal testen (HTTPS oder localhost ist für WebCrypto nötig):
   ```powershell
   npx serve .
   # oder: python -m http.server 8080
   ```
   Danach `http://localhost:3000` bzw. `http://localhost:8080` öffnen und die
   Passphrase eingeben.

Beim ersten Entsperren ist **„Auf diesem Gerät merken“** standardmäßig aktiv:
Der nicht exportierbare Schlüssel wird in IndexedDB gespeichert, sodass die App
auf diesem Gerät beim nächsten Start ohne erneute Eingabe öffnet. Ohne Häkchen
wird bei jedem Kaltstart nach der Passphrase gefragt.

## Inhalte austauschen

1. **Texte:** `content.js` bearbeiten (`title`, `riddle`, `hint1`, `hint2`,
   `solution`, …).
2. **Bilder:** Fotos in `images/` ersetzen. Am einfachsten gleiche Dateinamen
   verwenden (`photo-couple.png`, `day-01.png` … `day-24.png`). Bei anderem
   Namen/Format den Pfad in `content.js` anpassen.
3. **Neu verschlüsseln:**
   ```powershell
   node encrypt.mjs
   ```
   Die Passphrase wird automatisch aus `.passphrase` gelesen.
4. **Cache-Version erhöhen** in `sw.js` (`advent-v2` → `advent-v3`), damit
   installierte Apps die neuen Dateien sicher übernehmen.
5. `secure/` und `sw.js` committen und pushen.

Der Salt in `.salt` bleibt dabei gleich: Bei unveränderter Passphrase bleiben
bereits entsperrte Geräte entsperrt. Wird die Passphrase geändert, fragt jedes
Gerät einmal neu.

**Nicht committen:** `content.js`, `images/*.png|jpg|webp`, `.passphrase`,
`.salt`. Prüfen mit:

```powershell
git status --ignored
```

## Wie die Verschlüsselung funktioniert

- **AES-256-GCM** für Meta-Daten und jedes Bild, mit zufälligem IV pro Datei.
- **PBKDF2-HMAC-SHA256**, 600 000 Iterationen, 16-Byte-Salt (aus `.salt`).
- `secure/meta.json` enthält nur technische Parameter (Salt, IV, Iterationen).
  Alle Texte, Titel und Bilddaten stecken in `meta.enc` bzw. `img/*.bin`.
- Die App entschlüsselt im Arbeitsspeicher; Bilder werden als Blob-URLs
  angezeigt. Es werden keine entschlüsselten Dateien gespeichert.
- Der Service Worker cached die **verschlüsselten** Dateien – die App
  funktioniert also auch offline, nachdem sie einmal entsperrt wurde.

Grenzen des Modells:

- Wer die Passphrase **und** das Repository hat, kann die Inhalte lesen.
- Wer Zugriff auf das entsperrte Gerät hat, sieht die Inhalte (das ist bei
  „auf diesem Gerät merken“ so gewollt).
- Der Quellcode der App ist öffentlich; schützenswert sind nur die
  verschlüsselten Inhalte.
- Eine schwache Passphrase kann offline angegriffen werden. Deshalb ist die
  automatisch erzeugte, lange Passphrase in `.passphrase` empfehlenswert.

## Veröffentlichen (GitHub Pages)

1. Repository öffentlich machen (bei GitHub Pages im kostenlosen Plan
   Voraussetzung). Wegen der Verschlüsselung ist das unkritisch.
2. Dateien pushen (`secure/` muss enthalten sein).
3. Repository → **Settings → Pages** → Source: **Deploy from a branch**,
   Branch `main`, Folder `/ (root)` → Save.
4. Nach ein bis zwei Minuten ist die App erreichbar unter
   `https://DEIN-NAME.github.io/REPO-NAME/`.
5. Da die Seite generisch betitelt ist und `noindex` gesetzt ist, fällt sie
   nicht durch persönliche Inhalte auf. Der Link bleibt trotzdem teilbar –
   ohne Passphrase ist er aber wertlos.

### Auf dem iPhone installieren

1. Link in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“** → Hinzufügen.
3. App vom Homescreen starten und einmal die Passphrase eingeben.

## Test-Modus

Um alle Türchen unabhängig vom Datum zu prüfen:

1. In `content.js` `testMode: true` setzen.
2. `node encrypt.mjs` ausführen und lokal testen.
3. Vor dem Verschenken wieder auf `false` setzen, erneut verschlüsseln,
   `CACHE_VERSION` erhöhen und pushen.

Im Test-Modus zeigt die App oben einen Hinweis an.

## Updates & Cache

`index.html`, `style.css`, `app.js` und `secure/` werden vom Service Worker
zuerst aus dem Netz geladen (mit Cache-Fallback). Nach Änderungen:

1. `node encrypt.mjs` (falls Inhalte geändert),
2. `CACHE_VERSION` in `sw.js` erhöhen,
3. pushen,
4. App auf dem iPhone schließen und neu öffnen. Falls das Update hartnäckig
   nicht ankommt: PWA vom Homescreen löschen und neu hinzufügen.

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| „Dieser Kalender ist noch nicht eingerichtet“ | `secure/` fehlt beim Hosting oder wurde nicht gepusht. `node encrypt.mjs` ausführen und `secure/` veröffentlichen. |
| „Bitte öffne den Kalender über HTTPS“ | WebCrypto benötigt HTTPS (oder localhost). GitHub Pages liefert HTTPS. |
| „Die Passphrase stimmt nicht“ | Exakte Schreibweise prüfen; nach Passphrase-Wechsel neu verschlüsseln. Passphrase steht in `.passphrase`. |
| Nach Update fragt jedes Mal die Passphrase | `.salt` wurde gelöscht/neu erzeugt oder die Passphrase wurde geändert. Einmal neu entsperren. |
| Alte Inhalte sichtbar | `CACHE_VERSION` in `sw.js` erhöhen und App neu öffnen. |
| Bild fehlt | Pfad/Dateiname in `content.js` prüfen; Bilder quadratisch, ca. 900 × 900 px. |
| Passphrase vergessen | Entschlüsselte Daten sind nicht wiederherstellbar. Mit lokalen Originalen (`content.js` + `images/`) und neuer Passphrase neu erzeugen. |

## Datenschutz-Checkliste vor dem Push

- [ ] `git status --ignored` zeigt `content.js`, `images/*`, `.passphrase`,
      `.salt` als ignoriert (nicht gestaged).
- [ ] `secure/` enthält nur `.json`, `.enc` und `.bin` – keine Klartextbilder.
- [ ] Passphrase extern gesichert.
- [ ] `.salt` gesichert (optional; verhindert erneute Abfragen nach Updates).

Viel Freude beim Verschenken!

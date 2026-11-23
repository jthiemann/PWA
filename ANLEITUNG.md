# Klickanleitung: Adventskalender aktualisieren

Diese Anleitung beschreibt Schritt für Schritt, wie du Texte, Hinweise, Bilder
und das App-Icon änderst und die aktualisierte App veröffentlichst. Du brauchst
dafür keine Programmierkenntnisse – nur den Explorer, einen Editor und ein
Terminal.

- **Live-Seite:** https://jthiemann.github.io/PWA/
- **Projektordner:** `C:\Users\julia\Desktop\ADV`
- **Wichtig:** `content.js`, `images/`, `.passphrase` und `.salt` bleiben
  **lokal** und werden **nie** veröffentlicht. Nur `secure/` und `sw.js`
  werden gepusht.

---

## 1. Was ist wo?

| Datei / Ordner | Zweck | Öffentlich? |
|---|---|---|
| `content.js` | Alle Texte, Hinweise, Lösungen, Einstellungen | Nein (lokal) |
| `images/` | Originalfotos (Kopf + 24 Türchen) | Nein (lokal) |
| `.passphrase` | Deine Passphrase | Nein (lokal) |
| `.salt` | Technischer Salt für die Verschlüsselung | Nein (lokal) |
| `secure/` | Verschlüsselte Inhalte für die App | Ja |
| `sw.js` | Legt die Cache-Version fest | Ja |
| `apple-touch-icon.png` | Icon für den iPhone-Homescreen | Ja |
| `icons/` | Weitere App-Icons (192/512/1024, Maskable) | Ja |
| `index.html`, `app.js`, `style.css` | Die App selbst | Ja |

---

## 2. Vorbereitung (einmalig)

1. **Node.js prüfen:** Windows-Taste drücken, `powershell` eingeben, Enter.
   Dort eingeben:
   ```powershell
   node --version
   ```
   Es sollte eine Versionsnummer erscheinen (z. B. `v25.9.0`). Falls nicht:
   Node.js von https://nodejs.org installieren.
2. **Projektordner öffnen** (im Explorer):
   `C:\Users\julia\Desktop\ADV`
3. **Terminal im Projektordner öffnen:**
   Oben in die Adressleiste klicken, `powershell` eingeben, Enter.
4. **Passphrase bereithalten:** Sie steht in der Datei `.passphrase`.
   Bitte zusätzlich in einen Passwortmanager kopieren.

---

## 3. Texte und Hinweise ändern

1. Im Projektordner die Datei **`content.js`** mit einem Editor öffnen
   (Rechtsklick → Öffnen mit → Editor oder VS Code).
2. Für jeden Tag findest du einen Block wie diesen:
   ```js
   {
     day: 1,
     title: "Der erste Gruß",
     image: "images/day-01.png",
     riddle: "Hier steht das Rätsel …",
     hint1: "Erster Hinweis …",
     hint2: "Zweiter Hinweis …",
     solution: "Die Lösung …"
   },
   ```
3. Ändere nur den Text **zwischen den Anführungszeichen**. Achte darauf, dass
   Kommas und Anführungszeichen erhalten bleiben.
   - `title` = Überschrift des Türchens
   - `riddle` = Rätsel oder persönliche Nachricht
   - `hint1` / `hint2` = die beiden Hinweise
   - `solution` = Auflösung
   - `day` und `image` bitte nicht versehentlich löschen
4. Datei **speichern** (Strg + S).
5. Im Terminal (im Projektordner) verschlüsseln:
   ```powershell
   node encrypt.mjs
   ```
   Erwartete Ausgabe: „secure/ aktualisiert …“
6. In **`sw.js`** die Cache-Version erhöhen, damit die App das Update lädt:
   ```js
   const CACHE_VERSION = "advent-v3";   // daraus z. B. "advent-v4" machen
   ```
   Einfach die Zahl am Ende hochzählen.
7. Veröffentlichen:
   ```powershell
   git add -A
   git status --short
   git commit -m "Inhalte aktualisiert"
   git push
   ```
8. Prüfen: In `git status --short` dürfen **nicht** `content.js`,
   `images/...`, `.passphrase` oder `.salt` stehen. Sie werden durch
   `.gitignore` automatisch ausgeschlossen.
9. Etwa **1 Minute** warten. GitHub Pages baut die Seite automatisch neu.

---

## 4. Bilder ändern

### Ein Türchenbild ersetzen

1. Neues Foto in den Ordner **`images/`** legen.
2. **Einfachster Weg:** Das neue Bild genauso benennen wie das alte
   (z. B. `day-05.png`) und das alte überschreiben.
3. **Alternativ mit neuem Namen:** In `content.js` beim passenden Tag den Pfad
   anpassen:
   ```js
   image: "images/mein-bild.jpg",
   ```
4. Weiter wie in Abschnitt 3, ab Schritt 5:
   `node encrypt.mjs` → `CACHE_VERSION` erhöhen → committen/pushen.

### Kopffoto ersetzen

1. Neues Foto als **`images/photo-couple.png`** speichern (oder anderen Namen
   verwenden und in `content.js` bei `couplePhoto` eintragen).
2. Danach: `node encrypt.mjs` → `CACHE_VERSION` erhöhen → committen/pushen.

### Tipps für Bilder

- Quadratisch zuschneiden, ca. **900 × 900 px**, JPG oder PNG.
- Wichtige Motive mittig platzieren (die App schneidet quadratisch zu).
- Originale zusätzlich sichern: Sie sind nach dem Verschlüsseln die einzige
  Möglichkeit, später noch Änderungen zu machen.

---

## 4b. App-Icon (Homescreen) ändern

**Vorbereitung:** Ein quadratisches Ausgangsbild, mindestens 1024 × 1024 px,
PNG oder JPG. Wichtig: **keine Transparenz** und **keine abgerundeten Ecken** –
iOS maskiert die Ecken selbst. Das Motiv sollte mittig und kontrastreich sein
(dunkler Hintergrund, helle Schrift/Grafik).

1. Ordner `C:\Users\julia\Desktop\ADV\icons` öffnen.
2. Diese Dateien ersetzen (gleiche Dateinamen behalten):
   - `icons/icon-1024.png` – Ausgangsgröße für iOS/Android
   - `icons/icon-512.png`, `icons/icon-192.png`
   - `icons/icon-512-maskable.png` – Motiv nur im inneren Bereich (~80 %)
   - `icons/icon-180.png`
   - `icons/favicon-32.png` (Browser-Tab, optional)
3. Zusätzlich die Datei **`apple-touch-icon.png`** im Projektordner ersetzen
   (180 × 180, gleiche Grafik). Sie wird von iOS bevorzugt geladen.
4. In `sw.js` die `CACHE_VERSION` erhöhen (z. B. `advent-v3` → `advent-v4`).
5. Veröffentlichen:
   ```powershell
   git add -A
   git commit -m "App-Icon aktualisiert"
   git push
   ```
   `node encrypt.mjs` ist **nicht** nötig – Icons sind nicht verschlüsselt.

6. Auf dem iPhone das alte Icon **lange drücken → Vom Home-Bildschirm
   entfernen**. Dann:
   - Einstellungen → Safari → Erweitert → Website-Daten →
     `jthiemann.github.io` löschen (entfernt auch den gemerkten
     Entsperr-Schlüssel; Passphrase wird erneut abgefragt),
   - Safari öffnen: `https://jthiemann.github.io/PWA/` (mit **Schrägstrich am
     Ende**),
   - Teilen-Symbol → **Zum Home-Bildschirm** → Hinzufügen.

**Wenn das alte Icon oder ein Buchstaben-Icon (z. B. „U“) bleibt:**

- Das Buchstaben-Icon ist ein iOS-Ersatzicon: iOS hat das Apple-Touch-Icon
  nicht bekommen (meist wegen Cache oder Installation über eine alte URL).
- Prüfe, ob das Icon in iOS im Modus **„Dunkel“/„Getönt“** dargestellt wird:
  Homescreen lange drücken → **Bearbeiten → Anpassen → Standard** wählen.
- Notfalls iPhone neu starten, Safari-Verlauf/Cache leeren und Icon erneut
  hinzufügen.
- Als letzte Option die Icon-Dateien umbenennen (z. B. `icon-180-v2.png`,
  `apple-touch-icon-v2.png`) und die Verweise in `index.html` und
  `manifest.json` anpassen. Dann lädt iOS garantiert neu.

Hinweis: Der Seitentitel bleibt bewusst generisch („Adventskalender“), damit
auf dem Homescreen kein persönlicher Titel auftaucht. Der persönliche Titel
steht nur innerhalb der App.

---

## 5. Auf dem iPhone aktualisieren

1. Die Adventskalender-App vom Homescreen **schließen** (nach oben wischen).
2. App **neu öffnen**.
3. Falls weiterhin alte Inhalte erscheinen:
   - Icon vom Homescreen löschen,
   - Link in **Safari** öffnen: https://jthiemann.github.io/PWA/
   - Teilen-Symbol → **„Zum Home-Bildschirm“** → Hinzufügen.
4. Die Passphrase muss nach einem normalen Update in der Regel **nicht neu**
   eingegeben werden.

---

## 6. Testmodus (alle Türchen vorab ansehen)

1. In `content.js` oben ändern:
   ```js
   testMode: true,
   ```
2. Verschlüsseln:
   ```powershell
   node encrypt.mjs
   ```
3. Lokal testen:
   ```powershell
   npx serve .
   ```
   Danach `http://localhost:3000` im Browser öffnen und Passphrase eingeben.
4. **Nicht mit `testMode: true` veröffentlichen!** Vor dem Push wieder auf
   `false` setzen, erneut `node encrypt.mjs` ausführen, `CACHE_VERSION`
   erhöhen und pushen.

---

## 7. Geöffnete Türchen zurücksetzen

Die Information „welches Türchen ist geöffnet“ liegt nur im Browser
(`localStorage`, Schlüssel `advent.opened.v1`).

**Am Computer:**

1. Seite öffnen.
2. Entwicklerkonsole öffnen (F12 → Konsole).
3. Eingeben und Enter:
   ```js
   localStorage.removeItem("advent.opened.v1"); location.reload();
   ```

**Auf dem iPhone (ohne Mac/Computer):**

1. Einstellungen → **Safari** → **Erweitert** → **Website-Daten**.
2. Nach `jthiemann.github.io` suchen und löschen.
3. Hinweis: Dabei wird auch der gemerkte Entsperr-Schlüssel entfernt – die
   Passphrase wird beim nächsten Öffnen erneut abgefragt.

---

## 8. Passphrase ändern (optional)

1. Datei **`.passphrase`** im Projektordner öffnen.
2. Inhalt durch die neue Passphrase ersetzen, speichern.
   Nutze eine **lange, zufällige** Passphrase (mindestens 12 Zeichen, besser
   20+).
3. Neu verschlüsseln:
   ```powershell
   node encrypt.mjs
   ```
4. `CACHE_VERSION` in `sw.js` erhöhen, committen, pushen.
5. Alle Geräte fragen beim nächsten Öffnen einmal die neue Passphrase ab.

> `.salt` bitte **nicht** löschen. Es sorgt dafür, dass Geräte bei
> Inhalts-Updates nicht ständig neu nach der Passphrase fragen.

---

## 9. Kontrolle vor dem Veröffentlichen

- [ ] `node encrypt.mjs` wurde ohne Fehler ausgeführt.
- [ ] `CACHE_VERSION` in `sw.js` wurde erhöht.
- [ ] `git status --short` zeigt **keine** Klartextdateien
      (`content.js`, `images/...`, `.passphrase`, `.salt`).
- [ ] Die lokale Seite funktioniert (Passphrase, Türchen, Hinweise, Lösung).
- [ ] Bei Testmodus: `testMode` steht wieder auf `false`.
- [ ] Passphrase und `.salt` sind im Passwortmanager gesichert.
- [ ] Originale (`content.js`, `images/`) sind zusätzlich gesichert.

---

## 10. Was passiert technisch?

- `node encrypt.mjs` liest `content.js` und die Bilder aus `images/`.
- Daraus entstehen mit **AES-256-GCM** verschlüsselte Dateien in `secure/`.
- Der Schlüssel wird aus deiner Passphrase mit **PBKDF2-HMAC-SHA256**
  (600.000 Iterationen) und dem Salt aus `.salt` abgeleitet.
- Im öffentlichen Repo liegen nur unlesbare Daten. Die App entschlüsselt sie
  erst nach Eingabe der Passphrase auf dem Gerät.
- Es werden **keine** entschlüsselten Dateien gespeichert; Bilder werden nur im
  Arbeitsspeicher als Blob angezeigt.

---

## 11. Einmalige Aufräumarbeiten (wichtig für die Sicherheit)

Diese beiden **privaten** Repos enthalten noch alte Klartext-Daten bzw. waren
nur ein Test und sollten gelöscht werden:

1. https://github.com/jthiemann/PWA-archiv-privat
2. https://github.com/jthiemann/pwa-token-probe-650393

Vorgehen je Repo:

1. Repo öffnen → **Settings**.
2. Ganz nach unten scrollen zur **Danger Zone**.
3. **Delete this repository** → Repo-Namen zur Bestätigung eingeben → löschen.

Zusätzlich empfohlen: **Zwei-Faktor-Authentifizierung** im GitHub-Konto
aktivieren.

---

## 12. Probleme und Lösungen

| Problem | Lösung |
|---|---|
| „Dieser Kalender ist noch nicht eingerichtet“ | `node encrypt.mjs` ausführen und `secure/` pushen. Prüfen, ob `secure/meta.json` im Repo liegt. |
| „Die Passphrase stimmt nicht“ | Schreibweise prüfen; nach Passphrase-Wechsel wurde neu verschlüsselt. Passphrase steht in `.passphrase`. |
| Alte Inhalte nach dem Update | `CACHE_VERSION` in `sw.js` erhöhen, pushen, App schließen und neu öffnen; notfalls Icon neu hinzufügen. |
| Bild fehlt | Pfad in `content.js` prüfen (Groß-/Kleinschreibung), Datei in `images/` prüfen, dann erneut verschlüsseln. |
| Gerät fragt plötzlich immer nach der Passphrase | `.salt` wurde gelöscht oder die Passphrase geändert. Einmal neu entsperren. |
| `node encrypt.mjs` meldet ein fehlendes Bild | Dateiname in `content.js` und `images/` abgleichen. |
| Homescreen zeigt ein Buchstaben-Icon statt des App-Icons | Siehe Abschnitt 4b: Icon löschen, Website-Daten löschen, URL mit Schrägstrich, neu hinzufügen. |
| `git push` verweigert | Prüfen, ob du im richtigen Ordner bist (`C:\Users\julia\Desktop\ADV`) und Internetzugang hast. |
| `content.js` erscheint in `git status` | Nicht committen. Datei ist per `.gitignore` geschützt; niemals `git add -f` verwenden. |

---

## 13. Sicherheit in Kürze

- Öffentlich sind nur verschlüsselte Daten; ohne Passphrase nicht lesbar.
- Die Passphrase hat ca. **99 Bit Entropie**; ein direkter Angriff auf die
  Verschlüsselung ist praktisch ausgeschlossen.
- Die größten Risiken sind **Passphrase-Verlust/Weitergabe**, ein **offenes
  entsperrtes Gerät**, eine **Übernahme des GitHub-Kontos** oder die
  **alten privaten Archive** (siehe Abschnitt 11).
- Ohne Passphrase gibt es **keine Wiederherstellung** der verschlüsselten
  Inhalte. Bewahre Passphrase, Salt und die Originale sicher auf.

---

## 14. Feststehende Befehle (Kurzfassung)

```powershell
# 1. In den Projektordner wechseln
cd C:\Users\julia\Desktop\ADV

# 2. Neu verschlüsseln
node encrypt.mjs

# 3. Cache-Version in sw.js erhöhen (manuell im Editor)

# 4. Veröffentlichen
git add -A
git status --short
git commit -m "Inhalte aktualisiert"
git push
```

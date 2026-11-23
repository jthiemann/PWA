# Bilder (lokale Quelle)

Dieser Ordner enthält die **unverschlüsselten Originalbilder** für den
Adventskalender. Er wird **nicht veröffentlicht** (siehe `.gitignore`) –
veröffentlicht wird nur der verschlüsselte Ordner `secure/`.

## Welche Datei wofür?

| Datei | Verwendung | Empfehlung |
|---|---|---|
| `photo-couple.png` | Rundes Foto im Kopfbereich | quadratisch, mind. 600 × 600 px |
| `day-01.png` … `day-24.png` | Bild im jeweiligen Türchen | quadratisch, ca. 900 × 900 px |

## So tauschst du ein Bild

**Einfachste Variante:** Dein Foto so umbenennen, dass es genauso heißt wie die
Datei, die ersetzt werden soll (z. B. `day-01.png`), und die alte Datei
überschreiben. Darauf achten, dass die Endung stimmt (`.png`).

**Mit anderem Dateinamen/Format:** Foto z. B. als `bild-01.jpg` speichern und in
`content.js` beim passenden Tag den Pfad anpassen:

```js
{
  day: 1,
  title: "Der erste Gruß",
  image: "images/bild-01.jpg",
  ...
}
```

## Nach dem Austauschen

```powershell
node encrypt.mjs
```

Danach `CACHE_VERSION` in `sw.js` erhöhen und `secure/` + `sw.js` committen.
Die Bilder liegen dann nur noch verschlüsselt (`secure/img/*.bin`) im Repo.

## Tipps

- **Format:** JPG für Fotos (kleiner), PNG für Grafiken mit Transparenz.
  WebP funktioniert auf modernen iPhones ebenfalls.
- **Dateigröße:** Fotos vor dem Hochladen auf ca. 900 × 900 px verkleinern und
  komprimieren (z. B. mit [Squoosh](https://squoosh.app) oder der Fotos-App).
  Das hält die App schnell und den Offline-Cache klein.
- **Zuschnitt:** Die App zeigt Bilder quadratisch (`object-fit: cover`).
  Wichtige Motive mittig platzieren.
- **Namensschema:** Wer mag, kann das Schema `day-01` … `day-24` beibehalten –
  dann müssen keine Pfade in `content.js` geändert werden.
- **Groß-/Kleinschreibung:** Bei GitHub Pages & Co. ist sie relevant –
  `Day-01.png` und `day-01.png` sind unterschiedliche Dateien.
- **Backup:** Da nur verschlüsselte Dateien veröffentlicht werden, sind diese
  Originale die einzige Möglichkeit, später Inhalte zu ändern. Bitte sichern.

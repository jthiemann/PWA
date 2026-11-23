Persönliche Adventskalender Web-App (PWA)
1. Projektziel & Kontext

Entwicklung einer maßgeschneiderten, mobil-optimierten Web-App (Progressive Web App / PWA) als persönlicher Adventskalender für eine einzelne Nutzerin (Ehefrau des Auftraggebers) auf einem iPhone (iOS Safari).
Die App soll über einen geheimen Link aufgerufen und per iOS-Funktion "Zum Home-Bildschirm" installiert werden, sodass sie sich wie eine native Vollbild-App verhält – ohne App-Store-Deployment.
2. Architektur & Tech-Stack

    Plattform: Mobile-First Web-App (optimiert für iPhone Viewport, Safari).

    Technologie: Single-Page-Application (SPA) mit reinem HTML5, CSS3 und Vanilla JavaScript (alternativ leichtgewichtiges Framework ohne komplexen Build-Step, bevorzugt aber eine eigenständige index.html + separate JSON/Asset-Struktur für einfaches Hosting).

    Hosting: Statisches Hosting über GitHub Pages, Vercel oder Netlify.

    Datenspeicherung (Client-Side): localStorage zum Speichern bereits geöffneter Türchen.

    Datenschutz / Sichtbarkeit: Keine Suchmaschinen-Indexierung (<meta name="robots" content="noindex, nofollow">), Hosting unter einer nicht erratbaren URL. Optional: Einfacher clientseitiger PIN-/Passwortschutz beim ersten Start.

3. Funktionale Anforderungen
3.1 Hauptansicht (Kalender-Übersicht)

    Header:

        Zentral platziertes, rundes oder stilvoll gerahmtes Foto des Paares.

        Personalisierbarer Titel (z. B. "Unser Adventskalender") und Untertitel.

    Türchen-Grid:

        24 interaktive Türchen (nummeriert von 1 bis 24).

        Design pro Türchen: Geschenk-Icon + Tageszahl (1–24).

        Visuelle Unterscheidung zwischen geschlossenen und bereits geöffneten Türchen (Status wird im localStorage persistiert).

    Atmosphäre / Effekte:

        Optionaler, performanter Schnee-Rieseleffekt im Vorder- oder Hintergrund (CSS- oder leichtgewichtige Canvas-Animation, die den iPhone-Akku schont und Klicks auf Türchen nicht blockiert pointer-events: none).

3.2 Datumsprüfung & "Schummel-Sperre"

    Stichtags-Logik: Ein Türchen darf sich erst öffnen lassen, wenn das aktuelle Systemdatum dem jeweiligen Dezember-Tag entspricht oder in der Vergangenheit liegt (Monat === Dezember && Tag >= Türchen-Nummer).

    Verfrühter Klick: Versucht die Nutzerin, ein zukünftiges Türchen zu öffnen, öffnet sich ein modales Popup (Overlay) mit einem wechselnden, humorvollen Hinweis-Text (z. B. "Geduld, Schatz! Dieses Türchen bleibt bis zum Stichtag verschlossen.").

    Entwickler-/Test-Modus: Ein Konfigurations-Flag (testMode = true/false) im Code, mit dem der Ersteller alle Türchen vorab unabhängig vom aktuellen Datum testen kann.

3.3 Türchen-Detailansicht (Rätsel-Seite)

Wird ein gültiges Türchen angeklickt, wechselt die Ansicht (ohne Seiten-Reload) zur Detail-Card des jeweiligen Tages:

    Inhalte:

        Tagesüberschrift (z. B. "Türchen 1 – 1. Dezember").

        Tagesindividuelles Bild (Foto, Illustration oder Hinweisbild).

        Textbereich für das jeweilige Rätsel oder eine persönliche Botschaft.

    Interaktive Hilfe- & Lösungs-Buttons (unterhalb des Rätseltextes):

        Button "Hinweis 1": Deckt bei Klick den ersten Hinweis-Text darunter auf (Accordion/Toggle-Box).

        Button "Hinweis 2": Deckt bei Klick den zweiten Hinweis-Text darunter auf.

        Button "Lösung": Visuell hervorgehobener Button, der bei Klick die Auflösung des Rätsels anzeigt.

    Navigation:

        Klar sichtbarer Zurück-Button ("← Zurück zum Kalender"), der zur Hauptansicht zurückführt.

4. Nicht-funktionale Anforderungen (UI/UX & iOS-Spezifika)

    iOS PWA Meta-Tags: Einbindung von apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style sowie einem apple-touch-icon (für ein schönes App-Icon auf dem iPhone-Homescreen).

    Design-Ästhetik: Festliches, warmes Farbschema (z. B. dunkles Nachtblau/Tannengrün als Hintergrund, tiefes Rot und Goldakzente für Türchen und Rahmen).

    Responsivität: Perfekte Darstellung auf gängigen iPhone-Displaygrößen (kein horizontales Scrollen, angenehme Touch-Flächen für Buttons und Türchen).

    Wartbarkeit der Inhalte: Die 24 Datensätze (Bild-Pfad, Titel, Rätseltext, Hinweis 1, Hinweis 2, Lösung) müssen sauber getrennt in einer leicht editierbaren Datenstruktur (JavaScript-Objekt oder data.json) liegen, damit der Nutzer Bilder und Texte ohne Programmierkenntnisse austauschen kann.

5. Nächste Schritte für den übernehmenden Agenten

    Projektstruktur anlegen: Trennung in index.html, style.css, app.js und einen Ordner /images (inklusive Platzhalter-Grafiken und Anleitung zum Austausch der Bilder).

    Passwortschutz (optional klären/einbauen): Kleiner, einmaliger Zugangscode-Screen vor dem ersten Öffnen (ebenfalls im localStorage speicherbar), falls gewünscht.

    Content-Template bereitstellen: Eine übersichtliche Vorlage für die 24 Tage erstellen, in die der Nutzer seine Rätsel eintragen kann.

    Deployment-Anleitung: Kurze Schritt-für-Schritt-Anleitung für das Hochladen auf GitHub Pages / Vercel und das Hinzufügen zum iPhone-Homescreen beilegen.


---

Pyjama Party wann? 5.?

Räume und Verstecke:
1 
2 
4 
5 
6 
7 
8 
9 
11 
12 
15 
17 
18 
20 
21 
22 
24 
Schoko-Eis oder bei Schnuff und schleife oder  oder ""


Türchen / Versteck / Rätsel:
1. Gym Künstlertisch
2. Zeitkapsel
3. In meiner Jackentasche (Windfang)
4. Kleiderzimmer Boxen
5. Klappsofa

Wieder da

6. Grizzlyflagge
7. Werkzeugkoffer
8. Spiegel
9. Jilli Bild
10. Räuchermännchen im Arbeitszimmer
    - Es ist in meinem Bauch, Waldmannsheil!

At home - ich kann wieder etwas verstecken!

11. Vogelhaus
12. Esszimmer Teppich
13. Unter meiner Tastatur
14. Saunasitzbank
15. Starwars Box
16. Gym hinter einem Bild
17. künstlerschrank
18. unter einer puzzlematte
19. Schatztruhe v. Gralher
20. Pitcher
21. Legoblumen im Arbeitszimmer
22. Werkbank
23. Tennistasche
24. In einem deiner Schuhe
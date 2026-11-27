/* ==========================================================
   Persönlicher Adventskalender – Logik
   Inhalte werden aus secure/ entschlüsselt (AES-256-GCM).
   Keine Abhängigkeiten, keine Build-Tools.
   ========================================================== */

(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    title: "Adventskalender",
    subtitle: "",
    testMode: false,
    snow: true,
    snowIntensity: 42,
    doorOrder: null
  };

  const DEFAULT_DOOR_ORDER = Array.from({ length: 24 }, (_, i) => i + 1);

  function getDoorOrder() {
    const raw = cfg.doorOrder;
    if (!Array.isArray(raw) || raw.length !== 24) return DEFAULT_DOOR_ORDER;
    const nums = raw.map(Number);
    const unique = new Set(nums);
    if (unique.size !== 24 || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 24)) {
      return DEFAULT_DOOR_ORDER;
    }
    return nums;
  }

  const STORAGE_OPENED = "advent.opened.v1";

  const KEY_DB = "advent-secure";
  const KEY_STORE = "keys";
  const KEY_ID = "session";

  const MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  const EARLY_MESSAGES = [
    "Geduld, Schatz! Dieses Türchen bleibt bis zum Stichtag fest verschlossen.",
    "Nichts da! Der Kalender hat strengere Regeln als der Weihnachtsmann.",
    "Dieses Päckchen schläft noch. Weck es an seinem Dezembertag.",
    "Hmm … du bist eindeutig zu neugierig. Aber ich liebe dich trotzdem.",
    "Kein Schummeln! Sonst gibt es dieses Jahr nur Kohle.",
    "Das Türchen ist noch im Backofen. Bitte warte, bis es fertig ist.",
    "Gute Dinge brauchen Zeit – genau wie Weihnachtsplätzchen.",
    "Erst der Stichtag, dann die Bescherung. So steht es im Vertrag.",
    "Ich habe extra nachgesehen: Heute ist noch nicht dieser Tag.",
    "Nur noch ein bisschen Geduld – Vorfreude ist die schönste Freude."
  ];

  const GIFT_SVG =
    '<svg class="door-gift" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="21" width="30" height="20" rx="2.4"></rect>' +
    '<path d="M7 15h34v6H7z"></path>' +
    '<path d="M24 15v26"></path>' +
    '<path d="M24 15c-2.8-7.4-11.4-7.6-11.4-2.2 0 4.4 7 4.6 11.4 2.2Z"></path>' +
    '<path d="M24 15c2.8-7.4 11.4-7.6 11.4-2.2 0 4.4-7 4.6-11.4 2.2Z"></path>' +
    "</g></svg>";

  let cfg = Object.assign({}, DEFAULT_CONFIG);
  let days = [];
  let dayMap = new Map();
  let secureMeta = null;
  let sessionKey = null;
  let photoEntry = null;
  let detailToken = 0;
  let snowStarted = false;
  let lastFocused = null;
  const imageUrls = new Map();

  /* ------------------------- Helpers ------------------------- */

  const $ = (id) => document.getElementById(id);

  const storage = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : raw;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        /* Privatmodus o. Ä. – dann eben ohne Speicherung */
      }
    }
  };

  function loadOpened() {
    try {
      const parsed = JSON.parse(storage.get(STORAGE_OPENED, "[]"));
      if (!Array.isArray(parsed)) return new Set();
      return new Set(
        parsed.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 24)
      );
    } catch (err) {
      return new Set();
    }
  }

  function saveOpened(set) {
    storage.set(STORAGE_OPENED, JSON.stringify(Array.from(set)));
  }

  const opened = loadOpened();

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function monthName(monthIndex) {
    return MONTHS[Math.max(0, Math.min(11, monthIndex))];
  }

  function formatGermanDate(day) {
    return day + ". " + monthName(11);
  }

  function b64ToBytes(value) {
    const binary = window.atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /* ---------------------- Schlüssel-Speicher ---------------------- */

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) {
        reject(new Error("Kein IndexedDB"));
        return;
      }
      const req = window.indexedDB.open(KEY_DB, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(KEY_STORE)) {
          req.result.createObjectStore(KEY_STORE);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function idbGetKey() {
    try {
      const db = await idbOpen();
      return await new Promise(function (resolve, reject) {
        const tx = db.transaction(KEY_STORE, "readonly");
        const req = tx.objectStore(KEY_STORE).get(KEY_ID);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    } catch (err) {
      return null;
    }
  }

  async function idbSetKey(key) {
    try {
      const db = await idbOpen();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(KEY_STORE, "readwrite");
        tx.objectStore(KEY_STORE).put(key, KEY_ID);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    } catch (err) {
      /* Ohne Speicherung wird eben erneut gefragt. */
    }
  }

  async function idbDeleteKey() {
    try {
      const db = await idbOpen();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(KEY_STORE, "readwrite");
        tx.objectStore(KEY_STORE).delete(KEY_ID);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    } catch (err) {
      /* ignorieren */
    }
  }

  /* ------------------------ Entschlüsselung ------------------------ */

  async function fetchPublicMeta() {
    const res = await fetch("secure/meta.json", { cache: "no-store" });
    if (!res.ok) throw new Error("meta-missing");
    const meta = await res.json();
    if (!meta || !meta.salt || !meta.iv || !meta.file) throw new Error("meta-invalid");
    if (!/^[A-Za-z0-9._-]+$/.test(String(meta.file))) throw new Error("meta-invalid");
    return meta;
  }

  function secureAssetUrl(file) {
    const build = secureMeta && secureMeta.build ? String(secureMeta.build) : "";
    return "secure/" + file + (build ? "?v=" + encodeURIComponent(build) : "");
  }

  function imageAssetUrl(entry) {
    if (!entry || !entry.file) return "";
    const rev =
      entry.rev ||
      (secureMeta && secureMeta.build ? String(secureMeta.build) : "");
    return "secure/" + entry.file + (rev ? "?r=" + encodeURIComponent(rev) : "");
  }

  async function deriveKey(passphrase, meta) {
    const raw = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(String(passphrase).normalize("NFC")),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: b64ToBytes(meta.salt),
        iterations: Number(meta.iterations) || 600000,
        hash: "SHA-256"
      },
      raw,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decryptBuffer(key, ivB64, data) {
    return window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(ivB64) },
      key,
      data
    );
  }

  async function decryptPayloadWith(key) {
    const res = await fetch(secureAssetUrl(secureMeta.file), { cache: "no-store" });
    if (!res.ok) throw new Error("payload-missing");
    const plain = await decryptBuffer(key, secureMeta.iv, await res.arrayBuffer());
    const payload = JSON.parse(new TextDecoder().decode(plain));
    if (!payload || !Array.isArray(payload.days) || payload.days.length === 0) {
      throw new Error("payload-invalid");
    }
    return payload;
  }

  async function getImageUrl(entry) {
    if (!entry) return null;
    if (typeof entry === "string") return entry;
    if (imageUrls.has(entry.file)) return imageUrls.get(entry.file);
    if (!sessionKey) throw new Error("locked");

    const res = await fetch(imageAssetUrl(entry));
    if (!res.ok) throw new Error("image-missing");
    const plain = await decryptBuffer(sessionKey, entry.iv, await res.arrayBuffer());
    const url = URL.createObjectURL(new Blob([plain], { type: entry.mime || "image/jpeg" }));
    imageUrls.set(entry.file, url);
    return url;
  }

  /* --------------------- Datums-/Schummel-Logik --------------------- */

  function isUnlocked(day, now) {
    if (cfg.testMode) return true;
    const today = now || new Date();
    const month = today.getMonth();
    const date = today.getDate();
    if (month === 11) return date >= Number(day);
    if (month === 0) return true; // Januar: Saison ist vorbei, alles bleibt offen
    return false;
  }

  function updateTodayStatus() {
    const el = $("todayStatus");
    if (!el) return;
    const now = new Date();
    const month = now.getMonth();
    const date = now.getDate();

    if (cfg.testMode) {
      el.textContent = "Testmodus aktiv – alle Türchen sind offen.";
      return;
    }

    if (month === 11) {
      if (date <= 24) {
        el.textContent =
          "Heute ist der " + date + ". Dezember · " +
          (dayMap.has(date) ? "Türchen " + date + " wartet auf dich." : "Bald ist Bescherung.");
      } else {
        el.textContent = "Alle Türchen sind offen. Frohe Weihnachten!";
      }
      return;
    }

    if (month === 0) {
      el.textContent = "Frohes neues Jahr! Alle Türchen bleiben geöffnet.";
      return;
    }

    const target = new Date(now.getFullYear(), 11, 1, 0, 0, 0, 0);
    const todayMidnight = new Date(now.getFullYear(), month, date, 0, 0, 0, 0);
    const diffDays = Math.round((target - todayMidnight) / 86400000);
    if (diffDays <= 0) {
      el.textContent = "Bald geht es los!";
    } else if (diffDays === 1) {
      el.textContent = "Morgen öffnet sich das erste Türchen.";
    } else {
      el.textContent = "Noch " + diffDays + " Tage bis zum 1. Dezember.";
    }
  }

  /* --------------------------- Platzhalter --------------------------- */

  function fallbackImage(day, note) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#0a1826"/><stop offset="1" stop-color="#123a34"/>' +
      "</linearGradient></defs>" +
      '<rect width="900" height="900" fill="url(#g)"/>' +
      '<rect x="40" y="40" width="820" height="820" fill="none" stroke="#d9b06a" stroke-width="6"/>' +
      '<text x="450" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="#f2d9a3">Türchen ' + day + "</text>" +
      '<text x="450" y="500" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="26" fill="#c9d6e2">' + (note || "Bild lädt …") + "</text>" +
      "</svg>";
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function fallbackPhoto() {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#181020"/><stop offset="1" stop-color="#0c282c"/>' +
      "</linearGradient></defs>" +
      '<rect width="900" height="900" fill="url(#g)"/>' +
      '<circle cx="450" cy="450" r="320" fill="none" stroke="#d9b06a" stroke-width="8"/>' +
      '<path d="M450 590c-90-70-170-120-170-190 0-45 35-80 80-80 35 0 65 20 90 55 25-35 55-55 90-55 45 0 80 35 80 80 0 70-80 120-170 190Z" fill="#b9283c" opacity="0.8"/>' +
      "</svg>";
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  /* --------------------------- Kalender --------------------------- */

  function renderDoors() {
    const grid = $("doorGrid");
    if (!grid) return;
    const fragment = document.createDocumentFragment();

    const order = getDoorOrder();
    for (let index = 0; index < order.length; index++) {
      const day = order[index];
      const data = dayMap.get(day);
      const isOpen = opened.has(day);
      const unlocked = isUnlocked(day);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "door" + (isOpen ? " is-open" : "") + (!unlocked ? " is-locked" : "");
      btn.dataset.day = String(day);
      btn.style.setProperty("--i", String(index));
      btn.setAttribute(
        "aria-label",
        "Türchen " + day +
          (data && data.title ? " – " + data.title : "") +
          (isOpen ? " (geöffnet)" : !unlocked ? " (noch verschlossen)" : " (öffnen)")
      );

      btn.innerHTML =
        '<span class="door-number">' + day + "</span>" +
        GIFT_SVG +
        '<span class="door-badge" aria-hidden="true">' + (isOpen ? "✓" : !unlocked ? "🔒" : "") + "</span>";

      fragment.appendChild(btn);
    }

    grid.innerHTML = "";
    grid.appendChild(fragment);
  }

  function refreshDoor(day) {
    const btn = document.querySelector('.door[data-day="' + day + '"]');
    if (!btn) return;
    const data = dayMap.get(day);
    btn.classList.add("is-open");
    btn.classList.remove("is-locked");
    const badge = btn.querySelector(".door-badge");
    if (badge) badge.textContent = "✓";
    btn.setAttribute(
      "aria-label",
      "Türchen " + day + (data && data.title ? " – " + data.title : "") + " (geöffnet)"
    );
  }

  function markOpened(day) {
    if (opened.has(day)) return;
    opened.add(day);
    saveOpened(opened);
    refreshDoor(day);
  }

  /* ------------------------ Detailansicht ------------------------ */

  function resetReveal(boxId, buttonId, buttonLabel) {
    const box = $(boxId);
    const btn = $(buttonId);
    if (box) box.hidden = true;
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      if (buttonLabel) btn.textContent = buttonLabel;
    }
  }

  function showDetail(day) {
    const data = dayMap.get(day);
    if (!data) return;

    $("dayEyebrow").textContent = "Türchen " + day;
    $("dayTitle").textContent = data.title || "";
    $("dayDate").textContent = formatGermanDate(day);
    $("riddleText").textContent = data.riddle || "";

    const img = $("dayImage");
    const token = ++detailToken;
    img.onerror = function () {
      img.onerror = null;
      img.src = fallbackImage(day, "Bild nicht verfügbar");
    };
    img.src = fallbackImage(day);
    img.alt = "Türchen " + day + (data.title ? ": " + data.title : "");

    getImageUrl(data.image)
      .then(function (url) {
        if (url && token === detailToken) img.src = url;
      })
      .catch(function () {
        if (token === detailToken) img.src = fallbackImage(day, "Bild nicht verfügbar");
      });

    const hint1 = String(data.hint1 || "").trim();
    const hint2 = String(data.hint2 || "").trim();
    const hint1Button = $("hint1Button");
    const hint2Button = $("hint2Button");
    const hint1Box = $("hint1Box");
    const hint2Box = $("hint2Box");
    const bothHints = Boolean(hint1 && hint2);
    const singleHintLabel = "Hinweis";

    $("hint1Text").textContent = hint1;
    $("hint2Text").textContent = hint2;
    $("solutionText").textContent = data.solution || "Die Lösung folgt noch …";

    hint1Button.hidden = !hint1;
    hint2Button.hidden = !hint2;
    hint1Button.textContent = bothHints ? "Hinweis 1" : singleHintLabel;
    hint2Button.textContent = bothHints ? "Hinweis 2" : singleHintLabel;

    const hint1Label = hint1Box.querySelector(".reveal-label");
    const hint2Label = hint2Box.querySelector(".reveal-label");
    if (hint1Label) hint1Label.textContent = bothHints ? "Hinweis 1" : singleHintLabel;
    if (hint2Label) hint2Label.textContent = bothHints ? "Hinweis 2" : singleHintLabel;

    const actions = document.querySelector(".day-actions");
    if (actions) actions.hidden = !hint1 && !hint2;

    resetReveal("hint1Box", "hint1Button");
    resetReveal("hint2Box", "hint2Button");
    resetReveal("solutionBox", "solutionButton", "Lösung anzeigen");

    const card = $("dayCard");
    if (card) {
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
    }

    showScreen("detail");
    window.scrollTo(0, 0);
  }

  function toggleReveal(boxId, buttonId, openLabel, closeLabel) {
    const box = $(boxId);
    const btn = $(buttonId);
    if (!box || !btn) return;
    const willOpen = box.hidden;
    box.hidden = !willOpen;
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (openLabel && closeLabel) {
      btn.textContent = willOpen ? closeLabel : openLabel;
    }
    if (willOpen) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    }
  }

  /* --------------------------- Routing --------------------------- */

  function pathWithoutHash() {
    return window.location.pathname + window.location.search;
  }

  function showScreen(name) {
    const calendar = $("calendarScreen");
    const detail = $("detailScreen");
    if (!calendar || !detail) return;
    calendar.classList.toggle("is-hidden", name !== "calendar");
    detail.classList.toggle("is-hidden", name !== "detail");
  }

  function handleRoute() {
    const match = window.location.hash.match(/^#\/tag\/(\d{1,2})$/);

    if (match) {
      const day = Number(match[1]);
      const data = dayMap.get(day);

      if (data && isUnlocked(day)) {
        markOpened(day);
        showDetail(day);
        return;
      }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", pathWithoutHash());
      } else {
        window.location.hash = "";
      }
      showScreen("calendar");
      renderDoors();
      updateTodayStatus();
      return;
    }

    showScreen("calendar");
    updateTodayStatus();
  }

  function goToCalendar() {
    if (window.location.hash) {
      window.location.hash = "";
      window.setTimeout(function () {
        if (window.location.hash !== "#" && window.location.hash !== "") return;
        showScreen("calendar");
        updateTodayStatus();
      }, 60);
    } else {
      showScreen("calendar");
      updateTodayStatus();
    }
  }

  /* ------------------------ Früher Klick ------------------------ */

  function showEarlyModal(day) {
    const modal = $("earlyModal");
    const text = $("earlyModalText");
    if (!modal || !text) return;

    if (day && dayMap.has(day)) {
      text.textContent =
        "Türchen " + day + " öffnet sich erst am " + day + ". Dezember.\n" +
        EARLY_MESSAGES[Math.floor(Math.random() * EARLY_MESSAGES.length)];
    } else {
      text.textContent = EARLY_MESSAGES[Math.floor(Math.random() * EARLY_MESSAGES.length)];
    }

    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    const closeBtn = $("earlyModalClose");
    if (closeBtn) {
      window.setTimeout(function () { closeBtn.focus(); }, 30);
    }
  }

  function hideEarlyModal() {
    const modal = $("earlyModal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    lastFocused = null;
  }

  /* ---------------------------- Schnee ---------------------------- */

  function initSnow() {
    if (!cfg.snow || snowStarted) return;
    const canvas = $("snowCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    snowStarted = true;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let flakes = [];
    let rafId = null;
    let startTime = 0;
    let lastTime = 0;

    function makeFlake(randomY) {
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -12 - Math.random() * 40,
        r: 0.8 + Math.random() * 2.1,
        speed: 12 + Math.random() * 26,
        drift: 8 + Math.random() * 20,
        sway: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        color: "rgba(255,255,255," + (0.35 + Math.random() * 0.5).toFixed(2) + ")"
      };
    }

    function buildFlakes() {
      const base = Math.max(18, Math.round(width / 26));
      const factor = Math.max(0.35, Math.min(2, Number(cfg.snowIntensity) / 42 || 1));
      const count = Math.min(110, Math.round(base * factor));
      flakes = Array.from({ length: count }, function () { return makeFlake(true); });
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildFlakes();
      if (reduceMotion) drawStatic();
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.fill();
      }
    }

    function frame(time) {
      if (!startTime) startTime = time;
      const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0;
      lastTime = time;
      const t = (time - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speed * dt;
        f.x += Math.cos(t * f.sway + f.phase) * f.drift * dt;

        if (f.y - f.r > height) {
          f.y = -10 - Math.random() * 30;
          f.x = Math.random() * width;
        }
        if (f.x < -20) f.x = width + 20;
        if (f.x > width + 20) f.x = -20;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (reduceMotion || rafId !== null) return;
      lastTime = 0;
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    let resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resize();
        if (!reduceMotion && !document.hidden) {
          stop();
          start();
        }
      }, 180);
    });

    resize();
    start();
  }

  /* ------------------------ Entsperr-Bildschirm ------------------------ */

  function showUnlock(kind) {
    const screen = $("unlockScreen");
    const input = $("passphraseInput");
    const hint = $("unlockHint");
    const error = $("unlockError");
    const button = $("unlockButton");
    if (!screen) return;

    hideEarlyModal();
    $("calendarScreen").classList.add("is-hidden");
    $("detailScreen").classList.add("is-hidden");
    screen.classList.remove("is-hidden");
    if (error) error.hidden = true;

    if (kind === "file") {
      if (hint) {
        hint.textContent =
          "Bitte die Datei nicht per Doppelklick öffnen. Starte im Projektordner „npx serve .“ und öffne http://localhost:3000.";
      }
      if (input) input.disabled = true;
      if (button) {
        button.disabled = true;
        button.textContent = "Lokalen Server starten";
      }
      return;
    }

    if (kind === "missing") {
      if (hint) {
        hint.textContent =
          "Dieser Kalender ist noch nicht eingerichtet. Bitte zuerst „node encrypt.mjs“ ausführen und den Ordner secure/ veröffentlichen.";
      }
      if (input) input.disabled = true;
      if (button) {
        button.disabled = true;
        button.textContent = "Nicht eingerichtet";
      }
      return;
    }

    if (kind === "insecure") {
      if (hint) {
        hint.textContent =
          "Bitte über HTTPS oder http://localhost öffnen. Auf dem Handy im WLAN funktioniert eine http://-IP nicht – nutze die Live-Seite oder einen HTTPS-Tunnel.";
      }
      if (input) input.disabled = true;
      if (button) {
        button.disabled = true;
        button.textContent = "HTTPS erforderlich";
      }
      return;
    }

    if (hint) hint.textContent = "Gib deine Passphrase ein, um die 24 Türchen zu entschlüsseln.";
    if (input) {
      input.disabled = false;
      input.value = "";
    }
    if (button) {
      button.disabled = false;
      button.textContent = "Kalender entsperren";
    }
    window.setTimeout(function () {
      if (input && !input.disabled) input.focus();
    }, 120);
  }

  async function handleUnlock(event) {
    event.preventDefault();
    const input = $("passphraseInput");
    const error = $("unlockError");
    const button = $("unlockButton");
    const remember = $("rememberDevice");
    const form = $("unlockForm");
    if (!input || !button) return;
    if (!secureMeta) {
      showUnlock("missing");
      return;
    }

    const passphrase = String(input.value || "");
    if (!passphrase) {
      if (error) {
        error.textContent = "Bitte gib deine Passphrase ein.";
        error.hidden = false;
      }
      input.focus();
      return;
    }

    if (error) error.hidden = true;
    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Entschlüssele …";

    try {
      const key = await deriveKey(passphrase, secureMeta);
      const payload = await decryptPayloadWith(key);
      if (remember && remember.checked) {
        await idbSetKey(key);
      } else {
        await idbDeleteKey();
      }
      input.value = "";
      await startSession(key, payload);
    } catch (err) {
      let message = "Die Passphrase stimmt nicht. Bitte versuche es nochmal.";
      if (err && (err.name === "TypeError" || err.message === "payload-missing")) {
        message = "Die verschlüsselten Inhalte konnten nicht geladen werden. Bitte prüfe die Verbindung.";
      }
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      if (form) {
        const card = form.querySelector(".pin-card");
        if (card) {
          card.classList.remove("shake");
          void card.offsetWidth;
          card.classList.add("shake");
        }
      }
      input.value = "";
      input.focus();
    } finally {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }

  async function startSession(key, payload) {
    sessionKey = key;
    cfg = Object.assign({}, DEFAULT_CONFIG, payload.config || {});
    days = (payload.days || [])
      .map((d) => Object.assign({}, d, { day: Number(d.day) }))
      .filter((d) => Number.isInteger(d.day))
      .sort((a, b) => a.day - b.day);
    dayMap = new Map(days.map((d) => [d.day, d]));
    photoEntry = payload.photo || null;

    $("unlockScreen").classList.add("is-hidden");
    applyConfig();
    renderDoors();
    initSnow();
    updateTodayStatus();
    showScreen("calendar");
    handleRoute();
    loadHeaderPhoto();
  }

  /* ------------------------------ Krypto-Start ------------------------------ */

  async function init() {
    applyBaseUI();
    initEvents();
    registerServiceWorker();

    if (window.location.protocol === "file:") {
      showUnlock("file");
      return;
    }

    if (!window.crypto || !window.crypto.subtle) {
      showUnlock("insecure");
      return;
    }

    try {
      secureMeta = await fetchPublicMeta();
    } catch (err) {
      secureMeta = null;
    }

    if (!secureMeta) {
      showUnlock("missing");
      return;
    }

    const remembered = await idbGetKey();
    if (remembered) {
      try {
        const payload = await decryptPayloadWith(remembered);
        await startSession(remembered, payload);
        return;
      } catch (err) {
        await idbDeleteKey();
      }
    }

    showUnlock("ready");
  }

  /* ---------------------------- Events ---------------------------- */

  function initEvents() {
    const unlockForm = $("unlockForm");
    if (unlockForm) unlockForm.addEventListener("submit", handleUnlock);

    const grid = $("doorGrid");
    if (grid) {
      grid.addEventListener("click", function (event) {
        const btn = event.target.closest(".door");
        if (!btn) return;
        const day = Number(btn.dataset.day);
        if (!dayMap.has(day)) return;
        if (!isUnlocked(day)) {
          showEarlyModal(day);
          return;
        }
        if (window.location.hash === "#/tag/" + day) {
          markOpened(day);
          showDetail(day);
        } else {
          window.location.hash = "#/tag/" + day;
        }
      });
    }

    const back = $("backButton");
    if (back) back.addEventListener("click", goToCalendar);

    const hint1 = $("hint1Button");
    if (hint1) {
      hint1.addEventListener("click", function () {
        toggleReveal("hint1Box", "hint1Button");
      });
    }

    const hint2 = $("hint2Button");
    if (hint2) {
      hint2.addEventListener("click", function () {
        toggleReveal("hint2Box", "hint2Button");
      });
    }

    const solution = $("solutionButton");
    if (solution) {
      solution.addEventListener("click", function () {
        toggleReveal("solutionBox", "solutionButton", "Lösung anzeigen", "Lösung verbergen");
      });
    }

    const modal = $("earlyModal");
    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target.closest("[data-close-modal]")) hideEarlyModal();
      });
    }

    const close = $("earlyModalClose");
    if (close) close.addEventListener("click", hideEarlyModal);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") hideEarlyModal();
    });

    window.addEventListener("hashchange", handleRoute);

    window.addEventListener("pageshow", function (event) {
      if (event.persisted && sessionKey) handleRoute();
    });
  }

  /* ---------------------------- Start ---------------------------- */

  function applyBaseUI() {
    const year = $("footerYear");
    if (year) {
      const now = new Date();
      year.textContent = String(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    }
  }

  function applyConfig() {
    const title = cfg.title || "Adventskalender";
    document.title = "Adventskalender";
    const titleEl = $("appTitle");
    if (titleEl) titleEl.textContent = title;
    const subtitleEl = $("appSubtitle");
    if (subtitleEl) {
      subtitleEl.textContent = cfg.subtitle || "";
      subtitleEl.hidden = !cfg.subtitle;
    }
  }

  async function loadHeaderPhoto() {
    const img = $("couplePhoto");
    if (!img) return;
    img.onerror = function () {
      img.onerror = null;
      img.src = fallbackPhoto();
    };
    img.src = fallbackPhoto();
    if (!photoEntry) return;
    try {
      const url = await getImageUrl(photoEntry);
      if (url) img.src = url;
    } catch (err) {
      /* Platzhalter bleibt */
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const isSecure =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isSecure) return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* Ohne Service Worker funktioniert die App trotzdem – nur nicht offline. */
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

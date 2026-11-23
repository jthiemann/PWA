#!/usr/bin/env node
/* ==========================================================
   Verschlüsselung für den Adventskalender
   ----------------------------------------------------------
   Liest die lokalen Originale (content.js + images/) und
   schreibt daraus ausschließlich verschlüsselte Dateien nach
   secure/. Nur secure/ wird veröffentlicht.

   Aufruf:
     node encrypt.mjs "DEINE-PASSPHRASE"
   oder Passphrase in .passphrase speichern (wird automatisch
   gelesen, ist per .gitignore geschützt).
   ========================================================== */

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "secure");
const IMG_DIR = path.join(OUT_DIR, "img");
const SALT_FILE = path.join(ROOT, ".salt");
const ITERATIONS = 600000;

const b64 = (buf) => Buffer.from(buf).toString("base64");

async function getSalt() {
  try {
    const txt = await fs.readFile(SALT_FILE, "utf8");
    const bytes = Buffer.from(txt.trim(), "base64");
    if (bytes.length === 16) return bytes;
  } catch (err) {
    /* noch keine Salt-Datei */
  }
  const salt = crypto.randomBytes(16);
  await fs.writeFile(SALT_FILE, b64(salt) + "\n");
  return salt;
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "image/png";
}

async function readPassphrase() {
  if (process.argv[2]) return process.argv[2];
  if (process.env.ADVENT_PASSPHRASE) return process.env.ADVENT_PASSPHRASE;
  try {
    const txt = await fs.readFile(path.join(ROOT, ".passphrase"), "utf8");
    if (txt.trim()) return txt.trim();
  } catch (err) {
    /* keine Datei vorhanden */
  }
  return null;
}

async function loadContent() {
  const file = path.join(ROOT, "content.js");
  const source = await fs.readFile(file, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  const config = sandbox.window.ADVENT_CONFIG || {};
  const days = sandbox.window.ADVENT_DAYS || [];

  if (!Array.isArray(days) || days.length !== 24) {
    throw new Error("content.js muss genau 24 Einträge in ADVENT_DAYS enthalten.");
  }
  const seen = new Set();
  for (const day of days) {
    const n = Number(day.day);
    if (!Number.isInteger(n) || n < 1 || n > 24) throw new Error("Ungültige Tagesnummer: " + day.day);
    if (seen.has(n)) throw new Error("Doppelter Tag: " + n);
    seen.add(n);
    if (!day.image) throw new Error("Tag " + n + " hat kein Bild.");
  }
  return { config, days };
}

async function main() {
  const passphrase = await readPassphrase();
  if (!passphrase) {
    console.error("Keine Passphrase angegeben.");
    console.error('Aufruf: node encrypt.mjs "DEINE-PASSPHRASE"');
    console.error("Alternativ eine Datei .passphrase im Projektordner anlegen.");
    process.exit(1);
  }
  if (passphrase.trim().length < 8) {
    console.error("Die Passphrase ist zu kurz. Bitte mindestens 12 Zeichen verwenden.");
    process.exit(1);
  }

  const { config, days } = await loadContent();
  if (config.testMode === true) {
    console.warn("WARNUNG: testMode ist aktiv – alle Türchen wären jederzeit offen.");
  }

  const salt = await getSalt();
  const key = crypto.pbkdf2Sync(passphrase.trim().normalize("NFC"), salt, ITERATIONS, 32, "sha256");

  function encrypt(buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return { iv: b64(iv), data: Buffer.concat([ciphertext, cipher.getAuthTag()]) };
  }

  await fs.mkdir(IMG_DIR, { recursive: true });

  // Alte verschlüsselte Bilder entfernen
  for (const entry of await fs.readdir(IMG_DIR, { withFileTypes: true })) {
    if (entry.isFile()) await fs.unlink(path.join(IMG_DIR, entry.name));
  }

  async function encryptImage(sourceRel, outName) {
    const sourcePath = path.join(ROOT, sourceRel);
    let data;
    try {
      data = await fs.readFile(sourcePath);
    } catch (err) {
      throw new Error("Bild nicht gefunden: " + sourceRel);
    }
    const enc = encrypt(data);
    await fs.writeFile(path.join(IMG_DIR, outName), enc.data);
    return { file: "img/" + outName, iv: enc.iv, mime: mimeFor(sourceRel) };
  }

  if (!config.couplePhoto) throw new Error("couplePhoto fehlt in ADVENT_CONFIG.");
  const photo = await encryptImage(config.couplePhoto, "photo.bin");

  const outDays = [];
  for (const day of days) {
    const n = Number(day.day);
    const image = await encryptImage(day.image, "day-" + String(n).padStart(2, "0") + ".bin");
    outDays.push({
      day: n,
      title: day.title || "",
      riddle: day.riddle || "",
      hint1: day.hint1 || "",
      hint2: day.hint2 || "",
      solution: day.solution || "",
      image
    });
  }
  outDays.sort((a, b) => a.day - b.day);

  const payload = {
    version: 1,
    config: {
      title: config.title || "Adventskalender",
      subtitle: config.subtitle || "",
      testMode: config.testMode === true,
      snow: config.snow !== false,
      snowIntensity: Number(config.snowIntensity) || 42
    },
    photo,
    days: outDays
  };

  const meta = encrypt(Buffer.from(JSON.stringify(payload), "utf8"));
  await fs.writeFile(path.join(OUT_DIR, "meta.enc"), meta.data);

  const publicMeta = {
    version: 1,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: b64(salt),
    iv: meta.iv,
    file: "meta.enc"
  };
  await fs.writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(publicMeta, null, 2) + "\n");

  // Selbsttest: Meta wieder entschlüsseln
  const checkIv = Buffer.from(publicMeta.iv, "base64");
  const checkData = await fs.readFile(path.join(OUT_DIR, "meta.enc"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, checkIv);
  decipher.setAuthTag(checkData.subarray(checkData.length - 16));
  const plain = Buffer.concat([decipher.update(checkData.subarray(0, checkData.length - 16)), decipher.final()]);
  const check = JSON.parse(plain.toString("utf8"));
  if (check.days.length !== outDays.length) throw new Error("Selbsttest fehlgeschlagen.");

  console.log("secure/ aktualisiert:");
  console.log("  - meta.json, meta.enc");
  console.log("  - " + (outDays.length + 1) + " verschlüsselte Bilder in secure/img/");
  console.log("  - PBKDF2-SHA256, " + ITERATIONS + " Iterationen, AES-256-GCM");
  if (config.testMode === true) {
    console.log("");
    console.log("Hinweis: testMode ist noch aktiv. Vor dem Verschenken auf false setzen");
    console.log("und dieses Skript erneut ausführen.");
  }
  console.log("");
  console.log("Nicht veröffentlichen: content.js, images/, .passphrase");
  console.log("Nach Inhaltsänderungen: neu verschlüsseln und CACHE_VERSION in sw.js erhöhen.");
}

main().catch((err) => {
  console.error("FEHLER: " + err.message);
  process.exit(1);
});

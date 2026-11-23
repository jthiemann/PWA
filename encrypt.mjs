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

function normalizeDoorOrder(value) {
  const fallback = Array.from({ length: 24 }, (_, i) => i + 1);
  if (!Array.isArray(value) || value.length !== 24) return fallback;
  const nums = value.map(Number);
  if (
    new Set(nums).size !== 24 ||
    nums.some((n) => !Number.isInteger(n) || n < 1 || n > 24)
  ) {
    return fallback;
  }
  return nums;
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

  const CACHE_FILE = path.join(ROOT, ".encrypt-cache.json");
  const keyCheck = crypto.createHash("sha256").update(key).digest("hex");
  let cache = { version: 1, keyCheck, images: {} };
  try {
    const stored = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
    if (stored && stored.version === 1 && stored.keyCheck === keyCheck && stored.images) {
      cache = stored;
    }
  } catch (err) {
    /* noch kein Cache vorhanden */
  }

  const usedImages = new Set();
  let reusedCount = 0;
  let newCount = 0;

  function imageRevision(hash, ivB64) {
    return crypto
      .createHash("sha256")
      .update(hash + keyCheck + ivB64)
      .digest("hex")
      .slice(0, 12);
  }

  function decryptExisting(buffer, ivB64) {
    const iv = Buffer.from(ivB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(buffer.subarray(buffer.length - 16));
    return Buffer.concat([
      decipher.update(buffer.subarray(0, buffer.length - 16)),
      decipher.final()
    ]);
  }

  async function encryptImage(sourceRel, outName) {
    const sourcePath = path.join(ROOT, sourceRel);
    let data;
    try {
      data = await fs.readFile(sourcePath);
    } catch (err) {
      throw new Error("Bild nicht gefunden: " + sourceRel);
    }

    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const mime = mimeFor(sourceRel);
    const outPath = path.join(IMG_DIR, outName);
    const cached = cache.images[outName];

    if (cached && cached.sourceHash === hash && cached.mime === mime) {
      try {
        await fs.access(outPath);
        const existing = await fs.readFile(outPath);
        const plain = decryptExisting(existing, cached.iv);
        const plainHash = crypto.createHash("sha256").update(plain).digest("hex");
        if (plainHash === hash) {
          usedImages.add(outName);
          reusedCount++;
          return {
            file: "img/" + outName,
            iv: cached.iv,
            mime,
            rev: imageRevision(hash, cached.iv)
          };
        }
      } catch (err) {
        /* vorhandene Datei unbrauchbar -> neu verschlüsseln */
      }
    }

    const enc = encrypt(data);
    await fs.writeFile(outPath, enc.data);
    usedImages.add(outName);
    cache.images[outName] = { sourceHash: hash, iv: enc.iv, mime };
    newCount++;
    return {
      file: "img/" + outName,
      iv: enc.iv,
      mime,
      rev: imageRevision(hash, enc.iv)
    };
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

  for (const entry of await fs.readdir(IMG_DIR, { withFileTypes: true })) {
    if (entry.isFile() && !usedImages.has(entry.name)) {
      await fs.unlink(path.join(IMG_DIR, entry.name));
    }
  }

  const imageCache = {};
  for (const name of usedImages) imageCache[name] = cache.images[name];
  await fs.writeFile(
    CACHE_FILE,
    JSON.stringify({ version: 1, keyCheck, images: imageCache }, null, 2) + "\n"
  );

  const payload = {
    version: 1,
    config: {
      title: config.title || "Adventskalender",
      subtitle: config.subtitle || "",
      testMode: config.testMode === true,
      snow: config.snow !== false,
      snowIntensity: Number(config.snowIntensity) || 42,
      doorOrder: normalizeDoorOrder(config.doorOrder)
    },
    photo,
    days: outDays
  };

  const build = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .update(String(Date.now()))
    .update(crypto.randomBytes(8))
    .digest("hex")
    .slice(0, 16);

  const meta = encrypt(Buffer.from(JSON.stringify(payload), "utf8"));
  await fs.writeFile(path.join(OUT_DIR, "meta.enc"), meta.data);

  const publicMeta = {
    version: 1,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: b64(salt),
    iv: meta.iv,
    file: "meta.enc",
    build
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
  console.log("  - " + (outDays.length + 1) + " verschlüsselte Bilder (" + reusedCount + " wiederverwendet, " + newCount + " neu)");
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

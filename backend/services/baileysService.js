/**
 * Unofficial WhatsApp sending via Baileys (@whiskeysockets/baileys).
 *
 * IMPORTANT — read before using:
 * - This is NOT Meta's official API. It automates a real WhatsApp account
 *   by connecting like WhatsApp Web (QR code login), no API key needed.
 * - It's free, but it violates WhatsApp's Terms of Service. Meta has been
 *   banning unofficial-automation numbers more aggressively since late
 *   2025 — even a single recipient complaint can trigger a ban, with no
 *   warning first.
 * - Use a spare/secondary number for testing, not your main hospital
 *   business number, so a ban doesn't disrupt real patient communication.
 * - Keep the pinned version (@whiskeysockets/baileys ^6.7.22) — older
 *   versions have a known critical vulnerability (CVE-2026-48063) that lets
 *   an outside party spoof messages into your session.
 *
 * First run: a QR code prints in this terminal. Open WhatsApp on the phone
 * you're testing with → Settings → Linked Devices → Link a Device → scan
 * it. After that, the login is saved in ./baileys_auth_info and it
 * reconnects automatically on future server restarts (no re-scan needed
 * unless you delete that folder or get logged out).
 */

const path = require("path");
const qrcodeTerminal = require("qrcode-terminal");
const { Boom } = require("@hapi/boom");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

let sock = null;
let isReady = false;

const AUTH_FOLDER = path.join(__dirname, "..", "baileys_auth_info");

async function initBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // we render it ourselves below for a clearer message
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n========================================================");
      console.log("[WhatsApp/Baileys] Scan this QR with the test phone:");
      console.log("WhatsApp app -> Settings -> Linked Devices -> Link a Device");
      console.log("========================================================\n");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      isReady = true;
      console.log("[WhatsApp/Baileys] Connected. Ready to send.");
    }

    if (connection === "close") {
      isReady = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log(
          "[WhatsApp/Baileys] Logged out. Delete the baileys_auth_info folder and restart the server to link again."
        );
      } else {
        console.log("[WhatsApp/Baileys] Connection dropped, reconnecting...");
        initBaileys();
      }
    }
  });

  return sock;
}

function getStatus() {
  return { ready: isReady };
}

async function numberExistsOnWhatsApp(phone) {
  const [result] = await sock.onWhatsApp(phone);
  return Boolean(result?.exists);
}

async function sendOne(phone, message) {
  if (!isReady) {
    throw new Error("WhatsApp not connected yet — scan the QR code in the backend terminal first.");
  }
  const exists = await numberExistsOnWhatsApp(phone);
  if (!exists) {
    throw new Error("This number is not on WhatsApp (or has no country code).");
  }
  const jid = `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: message });
}

/**
 * Sends to each recipient one at a time with a randomized 2–5 second gap.
 * The delay isn't just politeness — sending 20 messages back-to-back in
 * under a second is exactly the pattern Meta's automation detection flags,
 * so this keeps the timing closer to a human tapping "send" repeatedly.
 */
async function bulkSend(recipients, buildMessage) {
  const results = [];
  for (const r of recipients) {
    try {
      const message = buildMessage(r);
      await sendOne(r.phone, message);
      results.push({ ...r, status: "sent" });
    } catch (err) {
      results.push({ ...r, status: "failed", error: err.message });
    }
    const delay = 2000 + Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return results;
}

module.exports = { initBaileys, getStatus, bulkSend };

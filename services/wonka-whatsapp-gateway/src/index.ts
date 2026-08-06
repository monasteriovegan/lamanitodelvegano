import http from "node:http";
import path from "node:path";
import process from "node:process";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const authFolder = process.env.AUTH_FOLDER ?? "/data/baileys-auth";
const ownerPhone = normalizePhone(process.env.OWNER_PHONE ?? "56990816124");
const port = Number(process.env.PORT ?? 3000);

let whatsappConnected = false;
let aiEnabled = true;
let lastEventAt: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pairingCode: string | null = null;
let pairingRequested = false;
let pairingTimer: NodeJS.Timeout | null = null;

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function phoneFromJid(jid?: string | null): string {
  if (!jid) return "";
  return normalizePhone(jidNormalizedUser(jid).split("@")[0] ?? "");
}

function getText(message: WAMessage): string {
  const content = message.message;
  if (!content) return "";
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    ""
  ).trim();
}

function isOwnerSelfChat(message: WAMessage): boolean {
  const remotePhone = phoneFromJid(message.key.remoteJid);
  return Boolean(message.key.fromMe && remotePhone === ownerPhone);
}

function parseOwnerCommand(text: string): "STOP" | "START" | "STATUS" | null {
  const normalized = text.toLocaleLowerCase("es").trim();
  if (/\b(deja|para|det[eé]n|apaga)\b.*\b(responder|respuestas|remy|ia)\b/.test(normalized)) return "STOP";
  if (/\b(vuelve|empieza|reanuda|activa|enciende)\b.*\b(responder|respuestas|remy|ia)\b/.test(normalized)) return "START";
  if (/\b(estado|activo|activa|funcionando|conectado)\b/.test(normalized)) return "STATUS";
  return null;
}

async function startWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(path.resolve(authFolder));
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    browser: Browsers.macOS("Google Chrome"),
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    lastEventAt = new Date().toISOString();

    if (!state.creds.registered && !pairingRequested && !pairingTimer && (connection === "connecting" || Boolean(qr))) {
      pairingTimer = setTimeout(() => {
        pairingTimer = null;
        if (state.creds.registered || pairingRequested) return;
        pairingRequested = true;
        void socket.requestPairingCode(ownerPhone)
          .then((code) => {
            pairingCode = code;
            logger.info({ pairingCode: code }, "CÓDIGO DE VINCULACIÓN WHATSAPP");
          })
          .catch((error: unknown) => {
            pairingRequested = false;
            logger.error({ error }, "No se pudo generar el código de vinculación");
          });
      }, 5000);
    }

    if (qr) {
      logger.info("QR alternativo disponible");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      whatsappConnected = true;
      pairingCode = null;
      pairingRequested = false;
      if (pairingTimer) clearTimeout(pairingTimer);
      pairingTimer = null;
      logger.info({ ownerPhone }, "Wonka WhatsApp Gateway conectado");
    }

    if (connection === "close") {
      whatsappConnected = false;
      if (pairingTimer) clearTimeout(pairingTimer);
      pairingTimer = null;
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      logger.warn({ statusCode, loggedOut }, "Conexión de WhatsApp cerrada");

      if (!loggedOut && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          pairingRequested = false;
          void startWhatsApp();
        }, 5000);
      }
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      lastEventAt = new Date().toISOString();
      const text = getText(message);
      if (!text) continue;

      if (isOwnerSelfChat(message)) {
        const command = parseOwnerCommand(text);
        if (command === "STOP") {
          aiEnabled = false;
          await socket.sendMessage(message.key.remoteJid!, { text: "🛑 Remy quedó pausado globalmente en WhatsApp." });
          continue;
        }
        if (command === "START") {
          aiEnabled = true;
          await socket.sendMessage(message.key.remoteJid!, { text: "✅ Remy quedó activo nuevamente en WhatsApp." });
          continue;
        }
        if (command === "STATUS") {
          await socket.sendMessage(message.key.remoteJid!, {
            text: `🎛️ Estado Wonka Gateway\nWhatsApp: ${whatsappConnected ? "conectado" : "desconectado"}\nRemy: ${aiEnabled ? "activo" : "pausado"}\nÚltimo evento: ${lastEventAt ?? "sin eventos"}`,
          });
          continue;
        }
      }

      if (message.key.fromMe) continue;
      logger.info({ remoteJid: message.key.remoteJid, messageId: message.key.id, aiEnabled, text }, "Mensaje entrante recibido");
      if (!aiEnabled) continue;
    }
  });
}

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "wonka-whatsapp-gateway", processRunning: true, whatsappConnected, aiEnabled, pairingCode, lastEventAt }));
    return;
  }
  if (request.url === "/pairing-code") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ whatsappConnected, pairingCode }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ service: "wonka-whatsapp-gateway", status: "running" }));
});

server.listen(port, "0.0.0.0", () => {
  logger.info({ port, authFolder }, "Servidor de salud iniciado");
  void startWhatsApp().catch((error: unknown) => {
    logger.error({ error }, "No se pudo iniciar WhatsApp");
    process.exitCode = 1;
  });
});

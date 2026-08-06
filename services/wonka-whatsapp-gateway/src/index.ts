import http from "node:http";
import path from "node:path";
import process from "node:process";
import { rm } from "node:fs/promises";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const authFolder = path.resolve(process.env.AUTH_FOLDER ?? "/data/baileys-auth");
const ownerPhone = normalizePhone(process.env.OWNER_PHONE ?? "56990816124");
const port = Number(process.env.PORT ?? 3000);

let whatsappConnected = false;
let aiEnabled = true;
let lastEventAt: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let latestQr: string | null = null;
let qrUpdatedAt: string | null = null;
let socketStarting = false;
const botMessageIds = new Set<string>();

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

function isOwnerCommandSource(message: WAMessage): boolean {
  const remoteJid = message.key.remoteJid ?? "";
  if (!message.key.fromMe) return false;
  if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) return false;
  return true;
}

function parseOwnerCommand(text: string): "STOP" | "START" | "STATUS" | null {
  const normalized = text.toLocaleLowerCase("es").trim();

  // Evita que Remy interprete sus propias respuestas como nuevas órdenes.
  // Todo comando administrativo debe comenzar explícitamente con Remy o Wonka.
  if (!/^(remy|wonka)\b[,:]?\s*/.test(normalized)) return null;

  const commandText = normalized.replace(/^(remy|wonka)\b[,:]?\s*/, "");
  if (/\b(deja|para|det[eé]n|apaga|pausa)\b.*\b(responder|respuestas|ia)?\b/.test(commandText)) return "STOP";
  if (/\b(vuelve|empieza|reanuda|activa|enciende)\b.*\b(responder|respuestas|ia)?\b/.test(commandText)) return "START";
  if (/\b(estado|activo|activa|funcionando|conectado|estatus)\b/.test(commandText)) return "STATUS";
  return null;
}

async function sendBotMessage(socket: ReturnType<typeof makeWASocket>, jid: string, text: string): Promise<void> {
  const sent = await socket.sendMessage(jid, { text });
  if (sent?.key?.id) {
    botMessageIds.add(sent.key.id);
    setTimeout(() => botMessageIds.delete(sent.key.id!), 120000);
  }
}

async function startWhatsApp(): Promise<void> {
  if (socketStarting || whatsappConnected) return;
  socketStarting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      lastEventAt = new Date().toISOString();

      if (qr) {
        latestQr = qr;
        qrUpdatedAt = new Date().toISOString();
        logger.info("QR web actualizado. Abre / para escanearlo.");
      }

      if (connection === "open") {
        whatsappConnected = true;
        socketStarting = false;
        latestQr = null;
        qrUpdatedAt = null;
        logger.info({ ownerPhone }, "Wonka WhatsApp Gateway conectado");
      }

      if (connection === "close") {
        whatsappConnected = false;
        socketStarting = false;
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        logger.warn({ statusCode, loggedOut }, "Conexión de WhatsApp cerrada");

        if (loggedOut) {
          latestQr = null;
          qrUpdatedAt = null;
          void rm(authFolder, { recursive: true, force: true })
            .then(() => scheduleReconnect(3000))
            .catch((error: unknown) => logger.error({ error }, "No se pudo limpiar la sesión inválida"));
          return;
        }

        scheduleReconnect(5000);
      }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify" && type !== "append") return;

      for (const message of messages) {
        lastEventAt = new Date().toISOString();
        const remoteJid = message.key.remoteJid;
        const messageId = message.key.id ?? "";

        if (messageId && botMessageIds.has(messageId)) continue;

        logger.info(
          {
            upsertType: type,
            remoteJid,
            remotePhone: phoneFromJid(remoteJid),
            fromMe: message.key.fromMe,
            participant: message.key.participant,
            messageId,
          },
          "Evento de mensaje recibido",
        );

        const text = getText(message);
        if (!text) continue;

        if (isOwnerCommandSource(message)) {
          const command = parseOwnerCommand(text);
          if (command === "STOP") {
            aiEnabled = false;
            await sendBotMessage(socket, remoteJid!, "🛑 Remy quedó pausado globalmente en WhatsApp.");
            continue;
          }
          if (command === "START") {
            aiEnabled = true;
            await sendBotMessage(socket, remoteJid!, "✅ Remy quedó activo nuevamente en WhatsApp.");
            continue;
          }
          if (command === "STATUS") {
            await sendBotMessage(
              socket,
              remoteJid!,
              `🎛️ Estado Wonka Gateway\nWhatsApp: ${whatsappConnected ? "conectado" : "desconectado"}\nRemy: ${aiEnabled ? "activo" : "pausado"}\nÚltimo evento: ${lastEventAt ?? "sin eventos"}`,
            );
            continue;
          }
        }

        if (message.key.fromMe) continue;
        logger.info({ remoteJid, messageId, aiEnabled, text }, "Mensaje entrante recibido");
      }
    });
  } catch (error) {
    socketStarting = false;
    logger.error({ error }, "No se pudo iniciar WhatsApp");
    scheduleReconnect(5000);
  }
}

function scheduleReconnect(delayMs: number): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void startWhatsApp();
  }, delayMs);
}

function htmlPage(): string {
  const body = whatsappConnected
    ? `<h1>✅ WhatsApp conectado</h1><p>El Gateway está listo.</p>`
    : latestQr
      ? `<h1>Vincula WhatsApp Business</h1><p>Abre WhatsApp Business → Dispositivos vinculados → Vincular dispositivo.</p><img src="/qr.png?t=${Date.now()}" alt="QR de WhatsApp"/><p>El QR se renueva automáticamente.</p>`
      : `<h1>Preparando vinculación…</h1><p>Esta página se actualizará sola.</p>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="8"><title>Wonka WhatsApp Gateway</title><style>body{font-family:system-ui;max-width:680px;margin:40px auto;padding:24px;text-align:center;background:#0f1115;color:#fff}img{background:#fff;padding:18px;border-radius:16px;width:min(420px,90vw)}p{color:#c9ced8}</style></head><body>${body}</body></html>`;
}

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith("/health")) {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, service: "wonka-whatsapp-gateway", whatsappConnected, aiEnabled, qrAvailable: Boolean(latestQr), qrUpdatedAt, lastEventAt }));
    return;
  }

  if (request.url?.startsWith("/qr.png")) {
    if (!latestQr) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("QR todavía no disponible");
      return;
    }
    const png = await QRCode.toBuffer(latestQr, { type: "png", width: 520, margin: 4, errorCorrectionLevel: "M" });
    response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store, no-cache, must-revalidate" });
    response.end(png);
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(htmlPage());
});

server.listen(port, "0.0.0.0", () => {
  logger.info({ port, authFolder }, "Servidor web del Gateway iniciado");
  void startWhatsApp();
});

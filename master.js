/**
 * masterService.js
 *
 * This master process connects to WhatsApp via Baileys and exposes an HTTP API
 * to send various types of messages. This way, you have a single active connection
 * and you can send any message type by calling the corresponding endpoint.
 *
 * Endpoints:
 *  - GET  /status          : Check connection status.
 *  - POST /sendText        : Send a text message.
 *  - POST /sendImage       : Send an image message.
 *  - POST /sendVideo       : Send a video message (or video note).
 *  - POST /sendAudio       : Send an audio message.
 *  - POST /sendDocument    : Send a document message.
 *  - POST /sendLocation    : Send a location message.
 *  - POST /sendContact     : Send a contact card (vCard).
 *  - POST /sendReaction    : Send a reaction (requires a message key).
 *  - POST /sendPoll        : Send a poll message.
 *
 * To run:
 *   node masterService.js
 */

import express from "express";
import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import P from "pino";

const logger = P({ level: "info" });
const app = express();
app.use(express.json());

// Configuration values.
const PORT = 3000;
const SESSION_FOLDER = "auth_info_master";
// Default target JID (WhatsApp ID, e.g., "1234567890@s.whatsapp.net") if none provided.
const DEFAULT_TARGET_JID = "YourPhoneNumber@s.whatsapp.net";

let sock; // Global variable to hold the active WhatsApp connection.

/**
 * startWhatsApp
 * Establishes the WhatsApp connection using Baileys.
 * Loads (or creates) a session in SESSION_FOLDER and prints a QR code
 * for initial authentication if needed.
 */
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true, // On first run, a QR code will be printed.
  });

  // Save credentials whenever updated.
  sock.ev.on("creds.update", saveCreds);

  // Listen for connection updates and handle reconnection.
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const errorCode = lastDisconnect?.error?.output?.statusCode;
      if (errorCode !== 401) {
        console.log("Connection closed. Reconnecting...");
        startWhatsApp();
      } else {
        console.log("Connection closed. Logged out.");
      }
    } else if (connection === "open") {
      console.log("Connected to WhatsApp!");
    }
  });
}

/* ===================== API Endpoints ===================== */

/**
 * GET /status
 * Returns the current connection status.
 */
app.get("/status", (req, res) => {
  if (sock && sock.state) {
    res.json({ status: "Connected", state: sock.state });
  } else {
    res.json({ status: "Not connected" });
  }
});

/**
 * POST /sendText
 * Sends a plain text message.
 * Expects JSON: { jid: optional, text: "message" }
 */
app.post("/sendText", async (req, res) => {
  const { jid, text } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { text });
    res.json({ status: "Text message sent", target });
  } catch (error) {
    console.error("Error sending text:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendImage
 * Sends an image message.
 * Expects JSON: { jid: optional, imageUrl: "url", caption: "optional caption" }
 */
app.post("/sendImage", async (req, res) => {
  const { jid, imageUrl, caption } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { image: { url: imageUrl }, caption: caption || "" });
    res.json({ status: "Image message sent", target });
  } catch (error) {
    console.error("Error sending image:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendVideo
 * Sends a video message.
 * Expects JSON: { jid: optional, videoUrl: "url", caption: "optional", videoNote: optional boolean }
 * If videoNote is true, sends as a video note.
 */
app.post("/sendVideo", async (req, res) => {
  const { jid, videoUrl, caption, videoNote } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    // Here, "gifPlayback" is used for GIFs; adjust if necessary for video notes.
    await sock.sendMessage(target, { video: { url: videoUrl }, caption: caption || "", gifPlayback: videoNote || false });
    res.json({ status: "Video message sent", target });
  } catch (error) {
    console.error("Error sending video:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendAudio
 * Sends an audio message.
 * Expects JSON: { jid: optional, audioUrl: "url", mimetype: "optional mimetype" }
 */
app.post("/sendAudio", async (req, res) => {
  const { jid, audioUrl, mimetype } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { audio: { url: audioUrl }, mimetype: mimetype || "audio/mpeg" });
    res.json({ status: "Audio message sent", target });
  } catch (error) {
    console.error("Error sending audio:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendDocument
 * Sends a document message.
 * Expects JSON: { jid: optional, documentUrl: "url", mimetype: "optional", filename: "optional" }
 */
app.post("/sendDocument", async (req, res) => {
  const { jid, documentUrl, mimetype, filename } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { document: { url: documentUrl }, mimetype: mimetype || "application/pdf", fileName: filename || "document" });
    res.json({ status: "Document message sent", target });
  } catch (error) {
    console.error("Error sending document:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendLocation
 * Sends a location message.
 * Expects JSON: { jid: optional, latitude: number, longitude: number, name: "optional", address: "optional" }
 */
app.post("/sendLocation", async (req, res) => {
  const { jid, latitude, longitude, name, address } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { location: { degreesLatitude: latitude, degreesLongitude: longitude, name: name || "", address: address || "" } });
    res.json({ status: "Location message sent", target });
  } catch (error) {
    console.error("Error sending location:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendContact
 * Sends a contact card message.
 * Expects JSON: { jid: optional, vcard: "vCard string" }
 */
app.post("/sendContact", async (req, res) => {
  const { jid, vcard } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { contacts: { displayName: "Contact", contacts: [{ vcard }] } });
    res.json({ status: "Contact message sent", target });
  } catch (error) {
    console.error("Error sending contact:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendReaction
 * Sends a reaction message. Note: requires a message key.
 * Expects JSON: { jid: optional, reaction: "emoji or text", key: message key object }
 */
app.post("/sendReaction", async (req, res) => {
  const { jid, reaction, key } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { react: { text: reaction, key } });
    res.json({ status: "Reaction sent", target });
  } catch (error) {
    console.error("Error sending reaction:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /sendPoll
 * Sends a poll message.
 * Expects JSON: { jid: optional, pollName: "Question", pollValues: [ "Option 1", "Option 2", ... ], selectableCount: number, toAnnouncementGroup: boolean (optional) }
 */
app.post("/sendPoll", async (req, res) => {
  const { jid, pollName, pollValues, selectableCount, toAnnouncementGroup } = req.body;
  const target = jid || DEFAULT_TARGET_JID;
  try {
    await sock.sendMessage(target, { poll: { name: pollName, values: pollValues, selectableCount: selectableCount, toAnnouncementGroup: toAnnouncementGroup || false } });
    res.json({ status: "Poll message sent", target });
  } catch (error) {
    console.error("Error sending poll:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ===================== End of API Endpoints ===================== */

/**
 * startService
 * Starts the WhatsApp connection and then starts the Express HTTP server.
 */
async function startService() {
  await startWhatsApp();
  app.listen(PORT, () => {
    console.log(`Master service running on port ${PORT}`);
  });
}

startService();

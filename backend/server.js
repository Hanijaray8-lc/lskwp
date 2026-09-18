require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const patientsRouter = require("./routes/patients");
const broadcastRouter = require("./routes/broadcast");
const baileysService = require("./services/baileysService");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

const whatsappMode = process.env.WHATSAPP_MODE || "wa_link";

// Baileys needs to open its WhatsApp Web connection once at startup (this is
// when the QR code prints in this terminal on first run).
if (whatsappMode === "baileys") {
  baileysService.initBaileys().catch((err) => {
    console.error("[WhatsApp/Baileys] Failed to initialize:", err.message);
  });
}

app.use("/api/patients", patientsRouter);
app.use("/api/broadcast", broadcastRouter);

app.get("/api/health", (req, res) => {
  const health = { status: "ok", whatsappMode };
  if (whatsappMode === "baileys") {
    health.baileys = baileysService.getStatus();
  }
  res.json(health);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] Homecare Camp Broadcast API running on port ${PORT}`);
  console.log(`[Server] WHATSAPP_MODE = ${whatsappMode}`);
});

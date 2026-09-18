const express = require("express");
const router = express.Router();
const Camp = require("../models/Camp");
const Patient = require("../models/Patient");
const { bulkSend } = require("../services/whatsappService");
const baileysService = require("../services/baileysService");

/**
 * POST /api/broadcast
 * body: {
 *   campType, date, time, location,
 *   messageTemplate,   // may contain {{name}} {{date}} {{time}} {{location}} {{campType}}
 *   patientIds: ["...", "..."]
 * }
 *
 * Behaviour depends on WHATSAPP_MODE in .env:
 *  - "cloud_api": actually sends via Meta WhatsApp Cloud API, returns per-patient status
 *  - "baileys"  : actually sends via an unofficial WhatsApp Web connection (Baileys),
 *                 no API key needed, but violates WhatsApp ToS — see services/baileysService.js
 *  - "wa_link"  : does NOT send anything server-side. Instead it just saves the camp
 *                 and returns a ready-made wa.me link per patient so the frontend can
 *                 open them (used when no Meta API key is configured yet).
 */
router.post("/", async (req, res) => {
  try {
    const { campType, date, time, location, messageTemplate, patientIds } = req.body;

    if (!campType || !date || !time || !location || !messageTemplate) {
      return res.status(400).json({ message: "campType, date, time, location, messageTemplate are required" });
    }
    if (!Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({ message: "Select at least one patient" });
    }

    const patients = await Patient.find({ _id: { $in: patientIds } });
    if (patients.length === 0) {
      return res.status(404).json({ message: "No matching patients found" });
    }

    const fillTemplate = (patient) =>
      messageTemplate
        .replace(/{{\s*name\s*}}/gi, patient.name)
        .replace(/{{\s*date\s*}}/gi, date)
        .replace(/{{\s*time\s*}}/gi, time)
        .replace(/{{\s*location\s*}}/gi, location)
        .replace(/{{\s*campType\s*}}/gi, campType);

    const camp = await Camp.create({
      campType,
      date,
      time,
      location,
      messageTemplate,
      selectedPatients: patients.map((p) => ({
        patient: p._id,
        phone: p.phone,
        name: p.name,
        status: "pending",
      })),
    });

    const mode = process.env.WHATSAPP_MODE || "wa_link";

    if (mode === "cloud_api") {
      const recipients = patients.map((p) => ({
        patientId: p._id,
        name: p.name,
        phone: p.phone,
      }));

      const results = await bulkSend(recipients, (r) => {
        const p = patients.find((x) => String(x._id) === String(r.patientId));
        // params order must match your approved template's {{1}} {{2}} {{3}} {{4}} variables
        return [p.name, campType, date, `${time}, ${location}`];
      });

      camp.selectedPatients = camp.selectedPatients.map((sp) => {
        const r = results.find((x) => String(x.patientId) === String(sp.patient));
        return { ...sp.toObject(), status: r?.status || "failed", error: r?.error };
      });
      camp.sentAt = new Date();
      await camp.save();

      const sentCount = results.filter((r) => r.status === "sent").length;
      const failedCount = results.filter((r) => r.status === "failed").length;

      return res.json({
        mode: "cloud_api",
        campId: camp._id,
        sentCount,
        failedCount,
        results,
      });
    }

    if (mode === "baileys") {
      const recipients = patients.map((p) => ({
        patientId: p._id,
        name: p.name,
        phone: p.phone,
      }));

      const results = await baileysService.bulkSend(recipients, (r) => {
        const p = patients.find((x) => String(x._id) === String(r.patientId));
        return fillTemplate(p);
      });

      camp.selectedPatients = camp.selectedPatients.map((sp) => {
        const r = results.find((x) => String(x.patientId) === String(sp.patient));
        return { ...sp.toObject(), status: r?.status || "failed", error: r?.error };
      });
      camp.sentAt = new Date();
      await camp.save();

      const sentCount = results.filter((r) => r.status === "sent").length;
      const failedCount = results.filter((r) => r.status === "failed").length;

      return res.json({
        mode: "baileys",
        campId: camp._id,
        sentCount,
        failedCount,
        results,
      });
    }

    // mode === "wa_link" (default / no API key configured yet)
    const links = patients.map((p) => ({
      patientId: p._id,
      name: p.name,
      phone: p.phone,
      message: fillTemplate(p),
      waLink: `https://wa.me/${p.phone.replace(/\D/g, "")}?text=${encodeURIComponent(fillTemplate(p))}`,
    }));

    return res.json({
      mode: "wa_link",
      campId: camp._id,
      count: links.length,
      links,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/broadcast/:campId  - fetch a past camp broadcast + its send report
router.get("/:campId", async (req, res) => {
  try {
    const camp = await Camp.findById(req.params.campId).populate("selectedPatients.patient");
    if (!camp) return res.status(404).json({ message: "Camp not found" });
    res.json(camp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/broadcast  - list all past camps (history)
router.get("/", async (req, res) => {
  try {
    const camps = await Camp.find().sort({ createdAt: -1 }).select("-selectedPatients");
    res.json(camps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

const mongoose = require("mongoose");

const CampSchema = new mongoose.Schema(
  {
    campType: { type: String, required: true, trim: true }, // e.g. "Eye Camp", "Blood Check Camp"
    date: { type: String, required: true }, // "2026-09-20"
    time: { type: String, required: true }, // "9:00 AM - 1:00 PM"
    location: { type: String, required: true, trim: true },
    messageTemplate: { type: String, required: true },
    selectedPatients: [
      {
        patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
        phone: String,
        name: String,
        status: {
          type: String,
          enum: ["pending", "sent", "failed"],
          default: "pending",
        },
        error: String,
      },
    ],
    sentAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Camp", CampSchema);

const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      trim: true,
      // stored in E.164-ish format e.g. 91XXXXXXXXXX (no + , no spaces)
    },
    age: { type: Number },
    gender: { type: String, enum: ["male", "female", "other"], default: "other" },
    area: { type: String, trim: true }, // locality / village / ward - used for camp targeting
    tags: [{ type: String, trim: true }], // e.g. ["diabetic", "senior-citizen"]
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

PatientSchema.index({ name: "text", phone: "text", area: "text" });

module.exports = mongoose.model("Patient", PatientSchema);

const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");

// GET /api/patients?search=&area=
router.get("/", async (req, res) => {
  try {
    const { search, area } = req.query;
    const query = {};
    if (area) query.area = area;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { area: { $regex: search, $options: "i" } },
      ];
    }
    const patients = await Patient.find(query).sort({ name: 1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients  (add single patient)
router.post("/", async (req, res) => {
  try {
    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/patients/bulk  (bulk import - array of patients)
router.post("/bulk", async (req, res) => {
  try {
    const { patients } = req.body; // [{name, phone, area, ...}, ...]
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ message: "patients array required" });
    }
    const created = await Patient.insertMany(patients, { ordered: false });
    res.status(201).json({ insertedCount: created.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/patients/:id
router.put("/:id", async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(patient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/patients/:id
router.delete("/:id", async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ message: "deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/patients/areas/list  (distinct areas for the filter dropdown)
router.get("/areas/list", async (req, res) => {
  try {
    const areas = await Patient.distinct("area");
    res.json(areas.filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

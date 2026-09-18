const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/docpilot_homecare";
    await mongoose.connect(uri);
    console.log("[DB] MongoDB connected:", uri);
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

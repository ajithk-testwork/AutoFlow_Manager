import mongoose from "mongoose";

const dailyLogSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer"
  },
  date: String, // e.g. "2026-04-27"
  status: {
    type: String,
    enum: ["Cleaned", "Skipped"],
    default: "Cleaned"
  }
}, { timestamps: true });

export default mongoose.model("DailyLog", dailyLogSchema);
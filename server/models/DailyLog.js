import mongoose from "mongoose";

const dailyLogSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["Cleaned", "Skipped"],
    default: "Cleaned"
  }
}, { timestamps: true });


dailyLogSchema.index({ customerId: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyLog", dailyLogSchema);
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer"
  },
  month: String,
  status: {
    type: String,
    default: "Pending"
  },
  dailyStatus: [
    {
      date: String,
      status: {
        type: String,
        enum: ["Cleaned", "Missed"],
        default: "Cleaned"
      }
    }
  ],
  missedDays: {
    type: Number,
    default: 0
  },
  amount: Number,
  paidDate: String
}, { timestamps: true });

export default mongoose.model("Payment", paymentSchema);
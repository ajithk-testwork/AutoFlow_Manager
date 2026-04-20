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
  amount: Number,
  paidDate: String
}, { timestamps: true });

export default mongoose.model("Payment", paymentSchema);
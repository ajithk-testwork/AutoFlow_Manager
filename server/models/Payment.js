import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service"
  },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },

  month: {
    type: String,
    required: true
  },

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

  amount: {
    type: Number,
    required: true
  },

  paidDate: String

}, { timestamps: true });

paymentSchema.index({
  tenantId: 1
});

paymentSchema.index({
  customerId: 1
});

paymentSchema.index({
  month: 1
});

export default mongoose.model(
  "Payment",
  paymentSchema
);
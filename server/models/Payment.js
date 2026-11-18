
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    // Payment month
    month: {
      type: String,
      required: true,
    },

    // Customer details snapshot
    customerName: {
      type: String,
      default: "",
    },

    customerPhone: {
      type: String,
      default: "",
    },

    customerDoorNumber: {
      type: String,
      default: "",
    },

    customerVehicleName: {
      type: String,
      default: "",
    },

    // Original amount when this month's payment was created
    baseAmount: {
      type: Number,
      default: 0,
    },

    // Final payable amount
    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      default: "Pending",
    },

    dailyStatus: [
      {
        date: String,

        status: {
          type: String,
          enum: ["Cleaned", "Missed"],
          default: "Cleaned",
        },
      },
    ],

    missedDays: {
      type: Number,
      default: 0,
    },

    paidDate: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({
  tenantId: 1,
});

paymentSchema.index({
  customerId: 1,
});

paymentSchema.index({
  month: 1,
});

// Optimized month + service + tenant lookup
paymentSchema.index({
  tenantId: 1,
  serviceId: 1,
  month: 1,
});

export default mongoose.model("Payment", paymentSchema);

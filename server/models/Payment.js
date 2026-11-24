
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
      required: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    month: {
      type: String,
      required: true,
      trim: true,
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

    // Original billing amount for this month
    baseAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // Final payable amount after missed-day adjustment
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Paid", "Pending", "Cancelled"],
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
      min: 0,
    },

    paidDate: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Query indexes
paymentSchema.index({ tenantId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ month: 1 });

// Monthly payment lookup
paymentSchema.index({
  tenantId: 1,
  serviceId: 1,
  month: 1,
});

// Prevent duplicate monthly payment records
paymentSchema.index(
  {
    tenantId: 1,
    serviceId: 1,
    customerId: 1,
    month: 1,
  },
  {
    unique: true,
    name: "unique_customer_month_payment",
  }
);

export default mongoose.model("Payment", paymentSchema);

import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
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

    name: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    doorNumber: {
      type: String,
      default: "",
    },

    vehicleName: {
      type: String,
      default: "",
    },

    monthlyAmount: {
      type: Number,
      required: true,
    },

    gender: {
      type: String,
      default: "male",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // WhatsApp Welcome Message Tracking
    welcomeMessageSent: {
      type: Boolean,
      default: false,
    },
    // Only newly added customers are eligible
    welcomeMessageEligible: {
      type: Boolean,
      default: false,
    },

    welcomeMessageSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
customerSchema.index({
  tenantId: 1,
});

customerSchema.index({
  serviceId: 1,
});

// Welcome message lookup
customerSchema.index({
  tenantId: 1,
  serviceId: 1,
  welcomeMessageSent: 1,
});

export default mongoose.model("Customer", customerSchema);

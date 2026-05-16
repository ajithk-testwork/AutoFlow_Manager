import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema({

  businessName: {
    type: String,
    required: true
  },

  ownerName: {
    type: String,
    required: true
  },

  email: {
    type: String,
    unique: true,
    required: true
  },

  whatsapp: String,

  upiId: { type: String, default: "" },
  qrCode: { type: String, default: "" },

  password: {
    type: String,
    required: true
  },

  // LOGIN STATUS
  isLoggedIn: {
    type: Boolean,
    default: false
  },

  // STORE JWT TOKEN
  token: {
    type: String,
    default: null
  },

  // TOKEN EXPIRY
  tokenExpiry: {
    type: Date,
    default: null
  },

  plan: {
    type: String,
    default: "free"
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

export default mongoose.model(
  "Client",
  tenantSchema
);
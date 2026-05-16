import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },

  serviceName: {
    type: String,
    required: true
  },

monthlyPrice: {
    type: Number,
    required: false, 
    default: 0
},

  description: String,

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

export default mongoose.model(
  "Service",
  serviceSchema
);
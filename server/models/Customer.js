import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({

  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Client",
    required: true
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service"
  },

  name: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  monthlyAmount: {
    type: Number,
    required: true
  },

  gender: {
    type: String,
    default: "male"
  },

  isActive: {
    type: Boolean,
    default: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true 
},

}, { timestamps: true });

customerSchema.index({
  tenantId: 1
});

customerSchema.index({
  serviceId: 1
});

export default mongoose.model(
  "Customer",
  customerSchema
);
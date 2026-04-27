import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  activeMonth: String,
  activeYear: Number
});

export default mongoose.model("Config", configSchema);
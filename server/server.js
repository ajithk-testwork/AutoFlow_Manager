import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import cusRouter from "./routes/customerRoute.js";

dotenv.config();

// Connect DB
connectDB();

const app = express();


app.use(cors({
  origin: [
    "http://localhost:5173", 
    "https://auto-flow-manager.vercel.app" 
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true
}));

app.use(express.json());


app.use("/api/customers", cusRouter);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
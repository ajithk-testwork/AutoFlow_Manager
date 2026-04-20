import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import cusRouter from "./routes/customerRoute.js";



dotenv.config();
connectDB()


const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/customers", cusRouter)

app.listen(process.env.PORT, () => {
    console.log(`Server running PORT ${process.env.PORT}`)
})
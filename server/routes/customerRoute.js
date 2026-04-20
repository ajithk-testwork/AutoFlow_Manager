import express from "express";
import {
  getCustomers,
  addCustomer,
  deleteCustomer,
  togglePayment,
  startNewMonth,
  getPaymentsByMonth,
  getCustomerHistory,
  generatePaymentLink,
  confirmPayment
} from "../controllers/customerController.js";

const cusRouter = express.Router();

// 🔥 CRITICAL: Put /pay at the absolute top so no other route blocks it
cusRouter.get("/pay", generatePaymentLink);
cusRouter.get("/confirm", confirmPayment);

cusRouter.get("/", getCustomers);
cusRouter.get("/payments", getPaymentsByMonth);
cusRouter.post("/start-month", startNewMonth);

cusRouter.get("/:id/history", getCustomerHistory);
cusRouter.post("/", addCustomer);
cusRouter.delete("/:id", deleteCustomer);
cusRouter.patch("/payment/:id/toggle", togglePayment);

export default cusRouter;
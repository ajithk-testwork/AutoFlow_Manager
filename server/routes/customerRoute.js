import express from "express";
import {
  getCustomers,
  addCustomer,
  deleteCustomer,
  togglePayment,
  startNewMonth,
  getPaymentsByMonth,
  getCustomerHistory,
  toggleDailyStatus,
  getDailyLogsByCustomer,

} from "../controllers/customerController.js";

const cusRouter = express.Router();


/// Daily
cusRouter.get("/daily", getDailyLogsByCustomer);
cusRouter.patch("/daily/:id/toggle", toggleDailyStatus);

// Monthly
cusRouter.get("/payments", getPaymentsByMonth);
cusRouter.post("/start-month", startNewMonth);
cusRouter.patch("/payment/:id/toggle", togglePayment);

// History
cusRouter.get("/:id/history", getCustomerHistory);

// Customers
cusRouter.get("/", getCustomers);
cusRouter.post("/", addCustomer);
cusRouter.delete("/:id", deleteCustomer);

export default cusRouter;
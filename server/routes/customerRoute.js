import express from "express";
import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  togglePayment,
  getPaymentsByMonth,
  getCustomerHistory,
  toggleDailyStatus,
  getDailyLogsByCustomer,
  getMonthlySummary,
  createDailyLog
} from "../controllers/customerController.js";

const cusRouter = express.Router();

/// ✅ DAILY ROUTES
cusRouter.get("/daily", getDailyLogsByCustomer);
cusRouter.post("/daily/create", createDailyLog);  // NEW: Auto-create
cusRouter.patch("/daily/:id/toggle", toggleDailyStatus);

/// ✅ MONTHLY ROUTES (NO start-month)
cusRouter.get("/payments", getPaymentsByMonth);
cusRouter.patch("/payment/:id/toggle", togglePayment);
cusRouter.get("/monthly-summary", getMonthlySummary);

/// ✅ HISTORY
cusRouter.get("/:id/history", getCustomerHistory);

/// ✅ CUSTOMER CRUD
cusRouter.get("/", getCustomers);
cusRouter.post("/", addCustomer);
cusRouter.put("/:id", updateCustomer);  // NEW: Update customer
cusRouter.delete("/:id", deleteCustomer);

export default cusRouter;
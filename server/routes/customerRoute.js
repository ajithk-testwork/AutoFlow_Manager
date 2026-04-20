import express from "express";
import {
  getCustomers,
  addCustomer,
  deleteCustomer,
  togglePayment,
  startNewMonth,
  getPaymentsByMonth,
  getCustomerHistory
} from "../controllers/customerController.js";

const cusRouter = express.Router();

cusRouter.get("/", getCustomers);
cusRouter.get("/:id/history", getCustomerHistory);
cusRouter.post("/", addCustomer);
cusRouter.delete("/:id", deleteCustomer);

// NEW
cusRouter.patch("/payment/:id/toggle", togglePayment);
cusRouter.post("/start-month", startNewMonth);
cusRouter.get("/payments", getPaymentsByMonth);

export default cusRouter;
import express from "express";

import {
  getCustomers,
  addCustomer,
  deleteCustomer,
  togglePayment,
  startNewMonth,
  getPaymentsByMonth,
  getCustomerHistory,
  updateDailyStatus,
  getSinglePayment,
  getGlobalHistory,
  updateCustomer
} from "../controllers/customerController.js";

import { login, logout, register, getAllClients } from "../controllers/authController.js";

import {  getServices, createService, deleteService } from "../controllers/serviceController.js";

import { protect } from "../middleware/authMiddleware.js";
import { getTemplate, saveTemplate } from "../controllers/whatsappTemplateController.js";
import upload from "../middleware/uploadMiddleware.js";

const cusRouter = express.Router();


 // AUTH ROUTES


cusRouter.post( "/register", register );
cusRouter.post( "/login", login );
cusRouter.post("/logout", protect, logout)
cusRouter.get( "/clients", getAllClients);



 // CUSTOMER ROUTES


// GLOBAL HISTORY
cusRouter.get( "/global/history", protect, getGlobalHistory);


cusRouter.get( "/getcustomer", protect, getCustomers);
cusRouter.post( "/", protect, addCustomer);
cusRouter.put( "/:id", protect, updateCustomer);
cusRouter.delete( "/:id", protect, deleteCustomer);
cusRouter.get( "/:id/history", protect, getCustomerHistory);



   //PAYMENT ROUTES

cusRouter.get( "/payments", protect, getPaymentsByMonth);
cusRouter.get( "/payment/:id", protect, getSinglePayment);


// TOGGLE PAYMENT
cusRouter.patch( "/payment/:id/toggle", protect, togglePayment);
cusRouter.post( "/start-month", protect, startNewMonth);
cusRouter.post( "/daily-status", protect, updateDailyStatus);



  // SERVICE ROUTES

cusRouter.get( "/services", protect, getServices);
cusRouter.post( "/services", protect, createService);
cusRouter.delete( "/services/:id", protect, deleteService);


// Whatsapp Template
cusRouter.post( "/whatsapp-template/save", protect, saveTemplate);

cusRouter.get( "/whatsapp-template/:serviceId", protect, getTemplate);

// IMAGE UPLOAD

cusRouter.post(
  "/upload",
  upload.single("image"),
  async (req, res) => {

    try {

      res.status(200).json({
        imageUrl: req.file.path
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Image upload failed"
      });

    }

  }
);

export default cusRouter;
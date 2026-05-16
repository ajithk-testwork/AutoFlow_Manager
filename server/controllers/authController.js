import Client from "../models/Client.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {

   try {

      const {
         businessName,
         ownerName,
         email,
         whatsapp,
         password,
         upiId,
       
      } = req.body;

      const existing = await Client.findOne({ email });

      if (existing) {
         return res.status(400).json({
            message: "Email already exists"
         });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

     const client = await Client.create({
         businessName,
         ownerName,
         email,
         whatsapp,
         upiId,
         qrCode,
         password: hashedPassword
      });

     

      res.status(201).json({
         message: "Account created"
      });

   } catch (error) {

      res.status(500).json({
         message: "Register failed"
      });

   }

};


export const login = async (req, res) => {

   try {

      const { email, password } = req.body;

      const tenant = await Client.findOne({ email });

      if (!tenant) {
         return res.status(400).json({
            message: "Invalid email"
         });
      }

      const isMatch = await bcrypt.compare(
         password,
         tenant.password
      );

      if (!isMatch) {
         return res.status(400).json({
            message: "Invalid password"
         });
      }

      const token = jwt.sign({

         tenantId: tenant._id,
         email: tenant.email

      },

         process.env.JWT_SECRET,

         {
            expiresIn: "7d"
         });

      tenant.isLoggedIn = true;

      tenant.token = token;

      tenant.tokenExpiry =
         new Date(

            Date.now() +

            7 * 24 * 60 * 60 * 1000

         );

      await tenant.save();

      res.json({
         token,
         tenant
      });
   } catch (error) {

      res.status(500).json({
         message: "Login failed"
      });

   }

};


export const logout = async (
   req,
   res
) => {

   try {

      const tenant =
         await Client.findById(
            req.user.tenantId
         );

      if (!tenant) {

         return res.status(404).json({
            message: "Client not found"
         });

      }

      tenant.isLoggedIn = false;

      tenant.token = null;

      tenant.tokenExpiry = null;

      await tenant.save();

      res.json({
         message: "Logout successful"
      });

   } catch {

      res.status(500).json({
         message: "Logout failed"
      });

   }

};

export const getAllClients = async (req, res) => {

   try {

      const tenants = await Client.find()
         .select("-password")
         .sort({ createdAt: -1 });

      const totalClients = tenants.length;

      const activeClients =
         tenants.filter(t => t.isLoggedIn).length;

      res.json({

         totalClients,

         activeClients,

         tenants

      });

   } catch (error) {

      res.status(500).json({
         message: "Failed to fetch tenants"
      });

   }

};
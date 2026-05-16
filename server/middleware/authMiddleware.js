import jwt from "jsonwebtoken";

import Client from "../models/Client.js";

export const protect = async (req, res, next) => {
   try {

      const authHeader = req.headers.authorization;

      if (!authHeader) {
         return res.status(401).json({
            message: "Unauthorized"
         });
      }

      // REMOVE "Bearer "
      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(
         token,
         process.env.JWT_SECRET
      );
      console.log(decoded)

      const tenant = await Client.findById(
         decoded.tenantId
      );
      console.log(tenant)

      if (!tenant) {
         return res.status(401).json({
            message: "Client not found"
         });
      }


      // TOKEN EXPIRY CHECK

      if (
         !tenant.tokenExpiry ||
         tenant.tokenExpiry < new Date()
      ) {

         tenant.isLoggedIn = false;

         tenant.token = null;

         tenant.tokenExpiry = null;

         await tenant.save();

         return res.status(401).json({
            message: "Session expired. Login again."
         });

      }

      req.user = decoded;
      req.tenantId = decoded.tenantId;

      next();

   } catch (error) {

      console.log(error);

      res.status(401).json({
         message: "Invalid token"
      });

   }
};
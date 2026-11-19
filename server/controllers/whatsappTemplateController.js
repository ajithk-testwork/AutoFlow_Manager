
import mongoose from "mongoose";
import WhatsappTemplate from "../models/WhatsappTemplate.js";
import Service from "../models/Service.js";

// ==========================================
// SAVE WHATSAPP TEMPLATES
// ==========================================

export const saveTemplate = async (req, res) => {
  try {
    const {
      serviceId,
      requestTemplate,
      reminderTemplate,
      thankyouTemplate,
      welcomeTemplate,
      upiId,
      phone,
    } = req.body;

    const tenantId = req.user?.tenantId;

    // Validate authentication
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Validate service ID
    if (!serviceId || !mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Valid Service ID is required",
      });
    }

    // Verify service belongs to logged-in tenant
    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Prepare only the fields provided by frontend
    const updateData = {};

    if (requestTemplate !== undefined)
      updateData.requestTemplate = requestTemplate;

    if (reminderTemplate !== undefined)
      updateData.reminderTemplate = reminderTemplate;

    if (thankyouTemplate !== undefined)
      updateData.thankyouTemplate = thankyouTemplate;

    if (welcomeTemplate !== undefined)
      updateData.welcomeTemplate = welcomeTemplate;

    if (upiId !== undefined)
      updateData.upiId = upiId;

    if (phone !== undefined)
      updateData.phone = phone;

    // Save or update template
    const template = await WhatsappTemplate.findOneAndUpdate(
      {
        tenantId,
        serviceId,
      },
      {
        $set: updateData,
        $setOnInsert: {
          tenantId,
          serviceId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "WhatsApp templates saved successfully",
      data: template,
    });

  } catch (error) {
    console.error("Save template error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ==========================================
// GET WHATSAPP TEMPLATES
// ==========================================


export const getTemplate = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    // Verify service belongs to this tenant
    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Find existing template
    let template = await WhatsappTemplate.findOne({
      tenantId,
      serviceId,
    });

    // Create a new document if it doesn't exist
    if (!template) {
      template = await WhatsappTemplate.create({
        tenantId,
        serviceId,
      });
    }

    // Existing documents do not automatically receive new schema defaults.
    // Backfill the missing welcomeTemplate without overwriting other fields.
    if (
      typeof template.welcomeTemplate !== "string" ||
      !template.welcomeTemplate.trim()
    ) {
      template.welcomeTemplate =
        WhatsappTemplate.schema
          .path("welcomeTemplate")
          .getDefault();

      await template.save();
    }

    console.log("TEMPLATE FETCH SUCCESS:", {
      tenantId: String(tenantId),
      serviceId: String(serviceId),
      welcomeTemplate: template.welcomeTemplate,
    });

    return res.status(200).json({
      success: true,
      data: template,
    });

  } catch (error) {
    console.error("Get template error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

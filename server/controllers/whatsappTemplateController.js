import WhatsappTemplate from "../models/WhatsappTemplate.js";
import Service from "../models/Service.js";

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

    const tenantId = req.user.tenantId;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
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

    const updateData = {};

    if (requestTemplate !== undefined)
      updateData.requestTemplate = requestTemplate;

    if (reminderTemplate !== undefined)
      updateData.reminderTemplate = reminderTemplate;

    if (thankyouTemplate !== undefined)
      updateData.thankyouTemplate = thankyouTemplate;

    if (welcomeTemplate !== undefined)
      updateData.welcomeTemplate = welcomeTemplate;

    if (upiId !== undefined) updateData.upiId = upiId;

    if (phone !== undefined) updateData.phone = phone;

    const template = await WhatsappTemplate.findOneAndUpdate(
      { tenantId, serviceId },
      {
        $set: updateData,
        $setOnInsert: { tenantId, serviceId },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
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

export const getTemplate = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const template = await WhatsappTemplate.findOne({
      tenantId: req.user.tenantId,
      serviceId,
    });

    return res.status(200).json(template || {});
  } catch (error) {
    console.error("Get template error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

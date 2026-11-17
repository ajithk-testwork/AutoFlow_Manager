
import WhatsappTemplate from "../models/WhatsappTemplate.js";

export const saveTemplate = async (req, res) => {
  try {
    const {
      serviceId,
      requestTemplate,
      reminderTemplate,
      thankyouTemplate,
      welcomeTemplate,
      upiId,
    } = req.body;

    const tenantId = req.user.tenantId;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    const existing = await WhatsappTemplate.findOne({
      tenantId,
      serviceId,
    });

    if (existing) {
      existing.requestTemplate = requestTemplate;
      existing.reminderTemplate = reminderTemplate;
      existing.thankyouTemplate = thankyouTemplate;
      existing.welcomeTemplate = welcomeTemplate;
      existing.upiId = upiId;

      await existing.save();

      return res.json({
        success: true,
        message: "Template updated",
      });
    }

    await WhatsappTemplate.create({
      tenantId,
      serviceId,
      requestTemplate,
      reminderTemplate,
      thankyouTemplate,
      welcomeTemplate,
      upiId,
    });

    return res.json({
      success: true,
      message: "Template saved",
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

    return res.json(template);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

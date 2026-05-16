import WhatsappTemplate from "../models/WhatsappTemplate.js";

export const saveTemplate = async (req, res) => {

    try {

        const {
            tenantId,
            serviceId,
            requestTemplate,
            reminderTemplate,
            thankyouTemplate,
            upiId
        } = req.body;

        let existing = await WhatsappTemplate.findOne({
            tenantId,
            serviceId
        });

        if (existing) {

            existing.requestTemplate = requestTemplate;
            existing.reminderTemplate = reminderTemplate;
            existing.thankyouTemplate = thankyouTemplate;
            existing.upiId = upiId;

            await existing.save();

            return res.json({
                success: true,
                message: "Template updated"
            });
        }

        await WhatsappTemplate.create({
            tenantId,
            serviceId,
            requestTemplate,
            reminderTemplate,
            thankyouTemplate,
            upiId
        });

        res.json({
            success: true,
            message: "Template saved"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


export const getTemplate = async (req, res) => {

    try {

        const { serviceId } = req.params;

        const template = await WhatsappTemplate.findOne({
            serviceId
        });

        res.json(template);

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};
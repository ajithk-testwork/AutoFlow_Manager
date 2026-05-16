import mongoose from "mongoose";

const whatsappTemplateSchema = new mongoose.Schema({

    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
        required: true
    },

    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true
    },

    requestTemplate: {
        type: String,
        default:
`Hello {{name}},

Your payment for {{service}} is pending.

Amount: ₹{{amount}}

Please pay using:
{{upi}}

Thank you.`
    },

    reminderTemplate: {
        type: String,
        default:
`Reminder 🚨

Hello {{name}},

Your payment for {{service}} is still pending.

Please complete payment soon.

Amount: ₹{{amount}}`
    },

    thankyouTemplate: {
        type: String,
        default:
`Thank you {{name}} ❤️

We received your payment successfully for {{service}}.

Thank you for choosing us.`
    },

    upiId: {
        type: String,
        default: ""
    }

}, { timestamps: true });

export default mongoose.model(
    "WhatsappTemplate",
    whatsappTemplateSchema
);
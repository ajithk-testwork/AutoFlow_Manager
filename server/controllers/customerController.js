import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";

// GET all customers
export const getCustomers = async (req, res) => {
  const customers = await Customer.find();
  res.json(customers);
};

// GET CUSTOMER HISTORY
export const getCustomerHistory = async (req, res) => {
  try {
    // FIX: populate "customerId" instead of "name" to get the customer details
    const history = await Payment.find({ customerId: req.params.id })
      .populate("customerId", "name phone") 
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// ADD customer
export const addCustomer = async (req, res) => {
  const newCustomer = await Customer.create(req.body);

  const currentMonth = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  // ADDED: Saving customerName directly in the payment record for easier frontend access
  await Payment.create({
    customerId: newCustomer._id,
    customerName: newCustomer.name, 
    month: currentMonth,
    amount: newCustomer.monthlyAmount,
    status: "Pending"
  });

  res.json(newCustomer);
};


// DELETE Customer & their Payment History
export const deleteCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;

    // 1. Delete the customer profile
    const deletedCustomer = await Customer.findByIdAndDelete(customerId);

    if (!deletedCustomer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    // 2. Delete ALL payment records connected to this customer
    await Payment.deleteMany({ customerId: customerId }); 

    res.json({ message: "Customer and all associated payment history completely deleted." });
    
  } catch (error) {
    console.error("Error deleting customer data:", error);
    res.status(500).json({ message: "Server error while deleting customer." });
  }
};  


// TOGGLE PAYMENT
export const togglePayment = async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  if (payment.status === "Pending") {
    payment.status = "Paid";
    payment.paidDate = new Date().toLocaleDateString('en-IN'); // Better format
  } else {
    payment.status = "Pending";
    payment.paidDate = null;
  }

  await payment.save();
  res.json(payment);
};

// Start New month
export const startNewMonth = async (req, res) => {
  const customers = await Customer.find();

  const newMonth = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  // ADDED: Including customerName here too
  const payments = customers.map(c => ({
    customerId: c._id,
    customerName: c.name, 
    month: newMonth,
    amount: c.monthlyAmount,
    status: "Pending"
  }));

  await Payment.insertMany(payments);

  res.json({ message: "New month created" });
};

export const getPaymentsByMonth = async (req, res) => {
  const { month } = req.query;

  const payments = await Payment.find({ month })
    .populate("customerId", "name phone monthlyAmount");

  res.json(payments);
};


export const generatePaymentLink = (req, res) => {
    const { amount } = req.query;
    
    // Hardcoding your details here makes it secure so users can't tamper with the URL
    const upiId = "quicklyajithda3@okicici"; 
    const name = "AutoFlow";
    
    // The native UPI intent protocol
    const upiUrl = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`;

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Opening Payment App...</title>
        </head>
        <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; background-color:#f8fafc; margin:0;">
            <div style="text-align:center;">
                <h2 style="color:#0f172a; margin-bottom: 10px;">Secure Payment</h2>
                <p style="color:#64748b; margin-bottom: 20px;">Opening your UPI app (GPay, PhonePe, etc.)...</p>
                <a href="${upiUrl}" style="background-color:#2563eb; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold; display:inline-block;">
                    Pay ₹${amount} Now
                </a>
            </div>
            <script>
                // Instantly force the phone to open the native UPI app
                window.location.href = "${upiUrl}";
            </script>
        </body>
        </html>
    `);
};



export const confirmPayment = async (req, res) => {
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).send("Customer ID missing");
    }

    const currentMonth = new Date().toLocaleString("default", {
      month: "long",
      year: "numeric"
    });

    const payment = await Payment.findOne({
      customerId,
      month: currentMonth
    });

    if (!payment) {
      return res.send("❌ Payment record not found");
    }

    // Prevent duplicate clicks
    if (payment.status === "Paid") {
      return res.send("✅ Already marked as paid");
    }

    payment.status = "Paid";
    payment.paidDate = new Date().toLocaleDateString("en-IN");

    await payment.save();

    res.send(`
      <h2 style="text-align:center;margin-top:50px;font-family:sans-serif;">
        ✅ Payment Confirmed! <br/>
        Thank you 🙏
      </h2>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};
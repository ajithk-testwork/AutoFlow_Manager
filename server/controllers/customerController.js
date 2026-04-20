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
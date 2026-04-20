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
    const history = await Payment.find({ customerId: req.params.id })
      .populate( "name")
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

  await Payment.create({
    customerId: newCustomer._id,
    month: currentMonth,
    amount: newCustomer.monthlyAmount
  });

  res.json(newCustomer);
};

// DELETE
export const deleteCustomer = async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};

// TOGGLE PAYMENT
export const togglePayment = async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  if (payment.status === "Pending") {
    payment.status = "Paid";
    payment.paidDate = new Date().toLocaleDateString();
  } else {
    payment.status = "Pending";
    payment.paidDate = null;
  }

  await payment.save();
  res.json(payment);
};



//Start New month
export const startNewMonth = async (req, res) => {
  const customers = await Customer.find();

  const newMonth = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const payments = customers.map(c => ({
    customerId: c._id,
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
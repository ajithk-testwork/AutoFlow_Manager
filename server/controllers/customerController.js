import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import DailyLog from "../models/DailyLog.js";

// GET all customers
export const getCustomers = async (req, res) => {
  const customers = await Customer.find();
  res.json(customers);
};

// GET CUSTOMER HISTORY
export const getCustomerHistory = async (req, res) => {
  try {
    const history = await Payment.find({ customerId: req.params.id })
      .populate("customerId", "name phone monthlyAmount")
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

// DELETE customer
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

// Start New Month
export const startNewMonth = async (req, res) => {
  const customers = await Customer.find();

  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();

  const monthName = today.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const logs = [];
  const payments = [];

  customers.forEach(c => {
    // Create payment
    payments.push({
      customerId: c._id,
      month: monthName,
      amount: c.monthlyAmount,
      status: "Pending"
    });

    // Create daily logs
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d)
        .toISOString()
        .split("T")[0];

      logs.push({
        customerId: c._id,
        date,
        status: "Cleaned"
      });
    }
  });

  await Payment.insertMany(payments);
  await DailyLog.insertMany(logs);

  res.json({ message: "New month + daily logs created" });
};

// Get payments by month
export const getPaymentsByMonth = async (req, res) => {
  const { month } = req.query;

  const payments = await Payment.find({ month })
    .populate("customerId", "name phone monthlyAmount");

  res.json(payments);
};

// Get monthly summary
export const getMonthlySummary = async (req, res) => {
  const { customerId } = req.query;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const logs = await DailyLog.find({
    customerId,
    date: {
      $gte: start.toISOString().split("T")[0],
      $lte: end.toISOString().split("T")[0]
    }
  });

  const totalDays = logs.length;
  const skippedDays = logs.filter(l => l.status === "Skipped").length;

  const customer = await Customer.findById(customerId);

  const perDayAmount = customer.monthlyAmount / totalDays;
  const deduction = skippedDays * perDayAmount;
  const finalAmount = customer.monthlyAmount - deduction;

  res.json({
    totalDays,
    skippedDays,
    deduction,
    finalAmount
  });
};

// Toggle daily status (PATCH)
export const toggleDailyStatus = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ message: "Log not found" });
    }

    log.status = log.status === "Cleaned" ? "Skipped" : "Cleaned";
    await log.save();

    res.json(log);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Get daily logs by customer (GET)
export const getDailyLogsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.query;
    
    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }
    
    const logs = await DailyLog.find({ customerId }).sort({ date: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
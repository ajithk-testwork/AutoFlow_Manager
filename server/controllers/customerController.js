import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";

/* ================================
   UTILITY (keep inside or move to utils)
================================ */
export const getMonthKey = () => {
  const date = new Date();
  return `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
};

/* ================================
   GET ALL CUSTOMERS
================================ */
export const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch {
    res.status(500).json({ message: "Error fetching customers" });
  }
};

/* ================================
   GET CUSTOMER HISTORY
================================ */
export const getCustomerHistory = async (req, res) => {
  try {
    const history = await Payment.find({ customerId: req.params.id })
      .populate("customerId", "name phone monthlyAmount")
      .sort({ createdAt: -1 });

    res.json(history);
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ================================
   ADD CUSTOMER
================================ */
export const addCustomer = async (req, res) => {
  try {
    const newCustomer = await Customer.create(req.body);

    const currentMonth = getMonthKey();

    await Payment.create({
      customerId: newCustomer._id,
      month: currentMonth,
      amount: newCustomer.monthlyAmount,
      status: "Pending",
      dailyStatus: [],
      missedDays: 0
    });

    res.json(newCustomer);
  } catch {
    res.status(500).json({ message: "Error adding customer" });
  }
};

/* ================================
   DELETE CUSTOMER
================================ */
export const deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
};

/* ================================
   TOGGLE PAYMENT STATUS
================================ */
export const togglePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (payment.status === "Pending") {
      payment.status = "Paid";
      payment.paidDate = new Date().toLocaleDateString("en-CA");
    } else {
      payment.status = "Pending";
      payment.paidDate = null;
    }

    await payment.save();
    res.json(payment);
  } catch {
    res.status(500).json({ message: "Toggle failed" });
  }
};

/* ================================
   GET PAYMENTS BY MONTH
================================ */
export const getPaymentsByMonth = async (req, res) => {
  try {
    let { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: "Month is required" });
    }

    month = month.trim();

    const payments = await Payment.find({ month })
      .populate("customerId", "name phone monthlyAmount");

    res.json(payments);
  } catch {
    res.status(500).json({ message: "Error fetching payments" });
  }
};

/* ================================
   GET SINGLE PAYMENT
================================ */
export const getSinglePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json(payment);
  } catch {
    res.status(500).json({ message: "Error fetching payment" });
  }
};

/* ================================
   START NEW MONTH (SMART)
================================ */
export const startNewMonth = async (req, res) => {
  try {
    const customers = await Customer.find();
    let newMonth = req.body.month;

    if (!newMonth) {
      return res.status(400).json({ message: "Month is required" });
    }

    newMonth = newMonth.trim();

    const existingPayments = await Payment.find({ month: newMonth });

    // already full
    if (existingPayments.length === customers.length) {
      return res.json({ message: "Month already created" });
    }

    const existingCustomerIds = existingPayments.map(p =>
      p.customerId.toString()
    );

    const newPayments = customers
      .filter(c => !existingCustomerIds.includes(c._id.toString()))
      .map(c => ({
        customerId: c._id,
        month: newMonth,
        amount: c.monthlyAmount,
        status: "Pending",
        dailyStatus: [],
        missedDays: 0
      }));

    await Payment.insertMany(newPayments);

    res.json({ message: "Month created successfully" });

  } catch {
    res.status(500).json({ message: "Error creating month" });
  }
};

/* ================================
   UPDATE DAILY STATUS (FIXED)
================================ */
export const updateDailyStatus = async (req, res) => {
  try {
    let { paymentId, date, status } = req.body;

    const payment = await Payment.findById(paymentId).populate("customerId");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const formattedDate = new Date(date).toISOString().split("T")[0];

    const existing = payment.dailyStatus.find(d => d.date === formattedDate);

    /* ✅ FIX: HANDLE UNDO */
    if (status === "None") {
      payment.dailyStatus = payment.dailyStatus.filter(
        d => d.date !== formattedDate
      );
    } else {
      if (existing) {
        existing.status = status;
      } else {
        payment.dailyStatus.push({ date: formattedDate, status });
      }
    }

    /* ✅ recalc missed */
    const missedDays = payment.dailyStatus.filter(
      d => d.status === "Missed"
    ).length;

    payment.missedDays = missedDays;

    /* ✅ FIX: ROUND VALUE */
    const monthlyAmount = payment.customerId.monthlyAmount;
    const perDay = monthlyAmount / 30;

    payment.amount = Math.round(monthlyAmount - (missedDays * perDay));

    await payment.save();

    res.json(payment);

  } catch {
    res.status(500).json({ message: "Error updating daily status" });
  }
};
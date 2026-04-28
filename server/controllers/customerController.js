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
    const { month, ...customerData } = req.body;

    if (!month) {
      return res.status(400).json({ message: "Month is required" });
    }

    const newCustomer = await Customer.create(customerData);

    await Payment.create({
      customerId: newCustomer._id,
      month: month.trim(),
      amount: newCustomer.monthlyAmount,
      status: "Pending",
      dailyStatus: [],
      missedDays: 0
    });

    res.status(201).json(newCustomer);  // ✅ Send 201 status for created
  } catch (error) {
    console.error("Error adding customer:", error);
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
   UPDATE DAILY STATUS (FIXED - Use explicit month parameter)
================================ */
export const updateDailyStatus = async (req, res) => {
  try {
    let { paymentId, date, status, month } = req.body; // Add month parameter

    const payment = await Payment.findById(paymentId).populate("customerId");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // ✅ FORMAT DATE - ensure consistent format
    const formattedDate = new Date(date).toISOString().split("T")[0];

    const existing = payment.dailyStatus.find(d => d.date === formattedDate);

    /* ✅ HANDLE UNDO */
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

    /* ✅ RECALCULATE MISSED DAYS */
    const missedDays = payment.dailyStatus.filter(
      d => d.status === "Missed"
    ).length;

    payment.missedDays = missedDays;

    /* ✅ FIXED: Use the passed month from frontend or fallback to payment.month */
    let targetMonth = month || payment.month;
    
    // Parse month (e.g., "April 2026")
    const monthParts = targetMonth.trim().split(" ");
    if (monthParts.length !== 2) {
      console.error("Invalid month format:", targetMonth);
      payment.amount = monthlyAmount;
      await payment.save();
      return res.json(payment);
    }
    
    const [monthName, yearStr] = monthParts;
    const year = parseInt(yearStr);
    
    // Get month index (0-11)
    const monthIndex = new Date(Date.parse(`${monthName} 1, ${year}`)).getMonth();
    
    // Get days in month
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const monthlyAmount = payment.customerId.monthlyAmount;
    
    const perDay = monthlyAmount / daysInMonth;
    
    // Calculate final amount
    let finalAmount = Math.round(monthlyAmount - (missedDays * perDay));
    // Ensure amount never goes below 0
    finalAmount = Math.max(0, finalAmount);
    
    payment.amount = finalAmount;

    await payment.save();

    res.json(payment);

  } catch (error) {
    console.error("Error updating daily status:", error);
    res.status(500).json({ message: "Error updating daily status" });
  }
};
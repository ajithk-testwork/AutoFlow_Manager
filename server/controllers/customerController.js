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
      .populate("customerId", "name phone monthlyAmount") // ✅ correct
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


export const getPaymentsByMonth = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: "Month is required" });
    }

    const payments = await Payment.find({ month })
      .populate("customerId", "name phone monthlyAmount");

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments" });
  }
};


export const getSinglePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payment" });
  }
};

//Start New month
// export const startNewMonth = async (req, res) => {
//   try {
//     const customers = await Customer.find();

//     // ✅ get month from frontend
//     const newMonth = req.body.month;

//     if (!newMonth) {
//       return res.status(400).json({ message: "Month is required" });
//     }

//     // ✅ prevent duplicate month
//     const exists = await Payment.findOne({ month: newMonth });

//     if (exists) {
//       return res.json({ message: "Month already created" });
//     }

//     const payments = customers.map(c => ({
//       customerId: c._id,
//       month: newMonth,
//       amount: c.monthlyAmount,
//       status: "Pending",
//       dailyStatus: [],
//       missedDays: 0
//     }));

//     await Payment.insertMany(payments);

//     res.json({ message: "New month created successfully" });

//   } catch (error) {
//     res.status(500).json({ message: "Error creating month" });
//   }
// };


export const updateDailyStatus = async (req, res) => {
  try {
    let { paymentId, date, status } = req.body;

    const payment = await Payment.findById(paymentId).populate("customerId");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // ✅ FORCE SAME FORMAT (YYYY-MM-DD)
    const formattedDate = new Date(date).toISOString().split("T")[0];

    const existing = payment.dailyStatus.find(d => d.date === formattedDate);

    if (existing) {
      existing.status = status;
    } else {
      payment.dailyStatus.push({ date: formattedDate, status });
    }

    // ✅ calculate missed days
    const missedDays = payment.dailyStatus.filter(
      d => d.status === "Missed"
    ).length;

    payment.missedDays = missedDays;

    // ✅ correct amount calculation
    const monthlyAmount = payment.customerId.monthlyAmount;
    const perDay = monthlyAmount / 30;

    payment.amount = monthlyAmount - (missedDays * perDay);

    await payment.save();

    res.json(payment);

  } catch (error) {
    res.status(500).json({ message: "Error updating daily status" });
  }
};
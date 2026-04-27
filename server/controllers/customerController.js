import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import DailyLog from "../models/DailyLog.js";
import Config from "../models/Config.js";

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
  
  // ✅ Don't auto-create payment record on customer add
  // Payment will be created when daily log is first toggled
  
  res.json(newCustomer);
};

// UPDATE customer
export const updateCustomer = async (req, res) => {
  try {
    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// DELETE customer
export const deleteCustomer = async (req, res) => {
  // Also delete related logs and payments
  await DailyLog.deleteMany({ customerId: req.params.id });
  await Payment.deleteMany({ customerId: req.params.id });
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
};

// TOGGLE PAYMENT
export const togglePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    const customer = await Customer.findById(payment.customerId);

    // Get all logs for this month
    const logs = await DailyLog.find({ customerId: customer._id });

    const cleanedDays = logs.filter(l => l.status === "Cleaned").length;
    const skippedDays = logs.filter(l => l.status === "Skipped").length;

    const totalDays = cleanedDays + skippedDays || 30;

    const perDay = customer.monthlyAmount / totalDays;

    const finalAmount =
      cleanedDays === 0 ? customer.monthlyAmount :
      Math.round(customer.monthlyAmount - (skippedDays * perDay));

    if (payment.status === "Pending") {
      payment.status = "Paid";
      payment.paidDate = new Date().toLocaleDateString();
      payment.amount = finalAmount; // ✅ IMPORTANT
    } else {
      payment.status = "Pending";
      payment.paidDate = null;
    }

    await payment.save();

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// ✅ NEW: Create daily log (AUTO-CREATE)
export const createDailyLog = async (req, res) => {
  try {
    const { customerId } = req.body;
    const today = new Date().toISOString().split("T")[0];
    
    // Check if log already exists for today
    const existingLog = await DailyLog.findOne({ 
      customerId, 
      date: today 
    });
    
    if (existingLog) {
      return res.status(400).json({ message: "Log already exists for today" });
    }
    
    const newLog = await DailyLog.create({
      customerId,
      date: today,
      status: "Cleaned"
    });
    
    res.json(newLog);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};



// Get payments by month
export const getPaymentsByMonth = async (req, res) => {
  const { month } = req.query;
  
  if (!month) {
    return res.status(400).json({ message: "Month parameter required" });
  }
  
  const payments = await Payment.find({ month })
    .populate("customerId", "name phone monthlyAmount gender");

  res.json(payments);
};

// ✅ FIXED: Monthly summary with dynamic calculation
export const getMonthlySummary = async (req, res) => {
  try {
    const { customerId } = req.query;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Month start & end
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Get logs
    const logs = await DailyLog.find({
      customerId,
      date: {
        $gte: startDateStr,
        $lte: endDateStr
      }
    });

    // ✅ Generate ALL working days (Mon–Sat)
    let workingDays = [];
    for (let d = 1; d <= endDate.getDate(); d++) {
      const date = new Date(year, month, d);
      if (date.getDay() !== 0) { // Sunday off
        workingDays.push(d);
      }
    }

    const totalWorkingDays = workingDays.length;

    let cleanedDays = 0;
    let skippedDays = 0;

    // ✅ If no logs → assume FULL service
    if (logs.length === 0) {
      cleanedDays = totalWorkingDays;
      skippedDays = 0;
    } else {
      for (const day of workingDays) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const log = logs.find(l => l.date === dateStr);

        if (log && log.status === "Cleaned") {
          cleanedDays++;
        } else {
          skippedDays++;
        }
      }
    }

    // ✅ Per day calculation
    const perDayRate = customer.monthlyAmount / totalWorkingDays;

    let finalAmount;

    if (cleanedDays === totalWorkingDays) {
      finalAmount = customer.monthlyAmount; // full payment
    } else {
      finalAmount = customer.monthlyAmount - (skippedDays * perDayRate);
    }

    res.json({
      totalDays: totalWorkingDays,
      cleanedDays,
      skippedDays,
      finalAmount: Math.round(finalAmount)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Toggle daily status (with auto-create)
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


// SET ACTIVE MONTH
export const setActiveMonth = async (req, res) => {
  const { month, year } = req.body;

  let config = await Config.findOne();

  if (!config) {
    config = await Config.create({
      activeMonth: month,
      activeYear: year
    });
  } else {
    config.activeMonth = month;
    config.activeYear = year;
    await config.save();
  }

  res.json(config);
};

// GET ACTIVE MONTH
export const getActiveMonth = async (req, res) => {
  const config = await Config.findOne();
  res.json(config);
};


export const getAllMonthlySummaries = async (req, res) => {
  try {
    const customers = await Customer.find();

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const results = [];

    for (const customer of customers) {
      const joinDate = new Date(customer.createdAt);

      const startDate = new Date(year, month, Math.max(1, joinDate.getDate()));
      if (joinDate.getFullYear() === year && joinDate.getMonth() === month) {
        startDate.setDate(joinDate.getDate());
      }

      const endDate = new Date(year, month + 1, 0);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const logs = await DailyLog.find({
        customerId: customer._id,
        date: { $gte: startDateStr, $lte: endDateStr }
      });

      const totalDays = logs.length;
      const cleanedDays = logs.filter(l => l.status === "Cleaned").length;
      const skippedDays = logs.filter(l => l.status === "Skipped").length;

      const daysInMonth = endDate.getDate();
      const daysInMonthFromStart = daysInMonth - startDate.getDate() + 1;

      const perDayRate = customer.monthlyAmount / daysInMonthFromStart;
      const finalAmount = customer.monthlyAmount - (skippedDays * perDayRate);

      results.push({
        customerId: customer._id,
        finalAmount: Math.round(finalAmount),
        cleanedDays,
        skippedDays,
        totalDays
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
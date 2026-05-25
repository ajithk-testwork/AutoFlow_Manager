import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";

export const getMonthKey = () => {
  const date = new Date();

  return `${date.toLocaleString("en-US", {
    month: "long"
  })} ${date.getFullYear()}`;
};

export const getCustomers = async (req, res) => {

  try {

    const customers = await Customer.find({

      tenantId: req.user.tenantId,
      serviceId: req.query.serviceId,
      isActive: true

    });

    res.json(customers);

  } catch {

    res.status(500).json({
      message: "Error fetching customers"
    });

  }

};

export const getCustomerHistory = async (
  req,
  res
) => {

  try {

    const history = await Payment.find({

      tenantId: req.user.tenantId,

      customerId: req.params.id

    })

      .populate(
        "customerId",
        "name phone doorNumber vehicleName  monthlyAmount"
      )

      .sort({
        createdAt: -1
      });

    res.json(history);

  } catch {

    res.status(500).json({
      message: "Server Error"
    });

  }

};

export const addCustomer = async (
  req,
  res
) => {

  try {

    const {
      month,
      ...customerData
    } = req.body;

    if (!month) {

      return res.status(400).json({
        message: "Month is required"
      });

    }

    const newCustomer =
      await Customer.create({

        ...customerData,

        tenantId: req.user.tenantId

      });

    await Payment.create({

      tenantId: req.user.tenantId,

      serviceId: newCustomer.serviceId,

      customerId: newCustomer._id,

      month: month.trim(),

      amount: newCustomer.monthlyAmount,

      status: "Pending",

      dailyStatus: [],

      missedDays: 0

    });

    res.status(201).json(newCustomer);

  } catch (error) {

    console.error(
      "Error adding customer:",
      error
    );

    res.status(500).json({
      message: "Error adding customer"
    });

  }

};

export const deleteCustomer = async (
  req,
  res
) => {

  try {

    await Customer.findOneAndDelete({

      _id: req.params.id,

      tenantId: req.user.tenantId

    });

    res.json({
      message: "Deleted"
    });

  } catch {

    res.status(500).json({
      message: "Delete failed"
    });

  }

};

export const togglePayment = async (
  req,
  res
) => {

  try {

    const payment = await Payment.findOne({

      _id: req.params.id,

      tenantId: req.user.tenantId

    });

    if (!payment) {

      return res.status(404).json({
        message: "Payment not found"
      });

    }

    if (payment.status === "Pending") {

      payment.status = "Paid";

      payment.paidDate =
        new Date().toLocaleDateString(
          "en-CA"
        );

    } else {

      payment.status = "Pending";

      payment.paidDate = null;

    }

    await payment.save();

    res.json(payment);

  } catch {

    res.status(500).json({
      message: "Toggle failed"
    });

  }

};

export const getPaymentsByMonth = async (
  req,
  res
) => {

  try {

    let { month } = req.query;

    if (!month) {

      return res.status(400).json({
        message: "Month is required"
      });

    }

    const payments = await Payment.find({

      tenantId: req.user.tenantId,

      month: month.trim()

    })

      .populate(
        "customerId",
        "name phone doorNumber vehicleName monthlyAmount gender isActive"
      );

    res.json(payments);

  } catch {

    res.status(500).json({
      message: "Error fetching payments"
    });

  }

};

export const getSinglePayment = async (
  req,
  res
) => {

  try {

    const payment = await Payment.findOne({

      _id: req.params.id,

      tenantId: req.user.tenantId

    });

    if (!payment) {

      return res.status(404).json({
        message: "Payment not found"
      });

    }

    res.json(payment);

  } catch {

    res.status(500).json({
      message: "Error fetching payment"
    });

  }

};

export const startNewMonth = async (
  req,
  res
) => {

  try {

    const customers = await Customer.find({

      tenantId: req.user.tenantId,

      isActive: true

    });

    let newMonth = req.body.month;

    if (!newMonth) {

      return res.status(400).json({
        message: "Month is required"
      });

    }

    newMonth = newMonth.trim();

    const existingPayments =
      await Payment.find({

        tenantId: req.user.tenantId,

        month: newMonth

      });

    const existingCustomerIds =
      existingPayments.map(
        p => p.customerId.toString()
      );

    const newPayments = customers

      .filter(c =>
        !existingCustomerIds.includes(
          c._id.toString()
        )
      )

      .map(c => ({

        tenantId: req.user.tenantId,

        serviceId: c.serviceId,

        customerId: c._id,

        month: newMonth,

        amount: c.monthlyAmount,

        status: "Pending",

        dailyStatus: [],

        missedDays: 0

      }));

    if (newPayments.length > 0) {

      await Payment.insertMany(newPayments);

    }

    res.json({
      message: "Month synced successfully"
    });

  } catch {

    res.status(500).json({
      message: "Error creating month"
    });

  }

};

export const updateDailyStatus = async (
  req,
  res
) => {

  try {

    let {
      paymentId,
      date,
      status,
      month
    } = req.body;

    const payment = await Payment.findOne({

      _id: paymentId,

      tenantId: req.user.tenantId

    }).populate("customerId");

    if (!payment) {

      return res.status(404).json({
        message: "Payment not found"
      });

    }

    const formattedDate =
      new Date(date)
        .toISOString()
        .split("T")[0];

    const existing =
      payment.dailyStatus.find(
        d => d.date === formattedDate
      );

    if (status === "None") {

      payment.dailyStatus =
        payment.dailyStatus.filter(
          d => d.date !== formattedDate
        );

    } else {

      if (existing) {

        existing.status = status;

      } else {

        payment.dailyStatus.push({
          date: formattedDate,
          status
        });

      }

    }

    const missedDays =
      payment.dailyStatus.filter(
        d => d.status === "Missed"
      ).length;

    payment.missedDays = missedDays;

    let targetMonth =
      month || payment.month;

    const [monthName, yearStr] =
      targetMonth.trim().split(" ");

    const year = parseInt(yearStr);

    const monthIndex =
      new Date(
        Date.parse(
          `${monthName} 1, ${year}`
        )
      ).getMonth();

    const daysInMonth =
      new Date(
        year,
        monthIndex + 1,
        0
      ).getDate();

    const monthlyAmount =
      payment.customerId.monthlyAmount;

    const perDay =
      monthlyAmount / daysInMonth;

    let finalAmount = Math.round(

      monthlyAmount -

      (missedDays * perDay)

    );

    finalAmount =
      Math.max(0, finalAmount);

    payment.amount = finalAmount;

    await payment.save();

    res.json(payment);

  } catch (error) {

    console.error(
      "Error updating daily status:",
      error
    );

    res.status(500).json({
      message: "Error updating daily status"
    });

  }

};

export const updateCustomer = async (
  req,
  res
) => {

  try {

    const {
      name,
      phone,
      doorNumber,
      vehicleName,
      monthlyAmount,
      gender,
      month
    } = req.body;

    const updatedCustomer =
      await Customer.findOneAndUpdate(

        {
          _id: req.params.id,

          tenantId: req.user.tenantId
        },

        {
          name,
          phone,
          doorNumber,
          vehicleName,
          monthlyAmount,
          gender
        },

        {
          new: true
        }

      );

    if (month) {

      const payment =
        await Payment.findOne({

          tenantId: req.user.tenantId,

          customerId: req.params.id,

          month: month

        });

      if (payment) {

        const [
          monthName,
          yearStr
        ] = month.trim().split(" ");

        const monthIndex =
          new Date(
            Date.parse(
              `${monthName} 1, ${yearStr}`
            )
          ).getMonth();

        const daysInMonth =
          new Date(
            parseInt(yearStr),
            monthIndex + 1,
            0
          ).getDate();

        const perDay =
          monthlyAmount / daysInMonth;

        let finalAmount = Math.round(

          monthlyAmount -

          (payment.missedDays * perDay)

        );

        payment.amount =
          Math.max(0, finalAmount);

        await payment.save();

      }

    }

    res.json(updatedCustomer);

  } catch {

    res.status(500).json({
      message: "Update failed"
    });

  }

};

export const getGlobalHistory = async (req, res) => {
  try {
    const { serviceId } = req.query;

    // 1. Find customers only in this specific workspace
    const customersInService = await Customer.find({
      tenantId: req.user.tenantId,
      serviceId: serviceId
    });

    const customerIds = customersInService.map(c => c._id);

    // 2. Fetch the raw payment data for these customers
    const payments = await Payment.find({
      customerId: { $in: customerIds }
    }).populate('customerId');

    // 3. THE MISSING LOGIC: Group the payments by month so the frontend can read it
    const groupedHistory = {};

    payments.forEach((payment) => {
      // If the month doesn't exist in our list yet, create it
      if (!groupedHistory[payment.month]) {
        groupedHistory[payment.month] = {
          month: payment.month,
          collected: 0,
          pending: 0,
          payments: []
        };
      }

      // Add the payment to this month's list
      groupedHistory[payment.month].payments.push(payment);

      // Add to the total collected or pending amounts
      if (payment.status === "Paid") {
        groupedHistory[payment.month].collected += payment.amount;
      } else {
        groupedHistory[payment.month].pending += payment.amount;
      }
    });

    // 4. Convert our grouped object into a clean array and send it to the frontend
    const result = Object.values(groupedHistory);
    res.json(result);

  } catch (error) {
    console.error("Global History Error:", error);
    res.status(500).json({ message: "Failed to fetch global history" });
  }
};
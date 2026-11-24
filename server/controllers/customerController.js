import Customer from "../models/Customer.js";
import Payment from "../models/Payment.js";
import Service from "../models/Service.js";

export const getMonthKey = () => {
  const date = new Date();

  return `${date.toLocaleString("en-US", {
    month: "long",
  })} ${date.getFullYear()}`;
};


export const getDashboardSummary = async (req, res) => {
  try {
    const { serviceId, month } = req.query;
    const tenantId = req.user.tenantId;

    // 1. Validate required fields
    if (!serviceId || !month || !month.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service ID and month are required",
      });
    }

    const selectedMonth = month.trim();

    // 2. Verify service belongs to logged-in tenant
    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // 3. Find all existing customers for this tenant and service.
    // This includes inactive customers to preserve their payment history.
    // Deleted customers will not be included.
    const existingCustomerIds = await Customer.distinct("_id", {
      tenantId,
      serviceId,
    });

    // 4. Build payment filter
    // Exclude:
    // - Cancelled payments
    // - Payments belonging to deleted customers
    const paymentFilter = {
      tenantId,
      serviceId,
      month: selectedMonth,
      status: { $in: ["Paid", "Pending"] },
      customerId: {
        $in: existingCustomerIds,
      },
    };

    // 5. Fetch dashboard data
    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      payments,
      recentCustomers,
    ] = await Promise.all([
      // Total customers
      Customer.countDocuments({
        tenantId,
        serviceId,
      }),

      // Active customers
      Customer.countDocuments({
        tenantId,
        serviceId,
        isActive: true,
      }),

      // Inactive customers
      Customer.countDocuments({
        tenantId,
        serviceId,
        isActive: false,
      }),

      // Valid payments only
      Payment.find(paymentFilter)
        .select("amount status customerId")
        .lean(),

      // Recently added active customers
      Customer.find({
        tenantId,
        serviceId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name phone vehicleName monthlyAmount isActive")
        .lean(),
    ]);

    // 6. Calculate payment amounts
    const expected = payments.reduce((sum, payment) => {
      return sum + (Number(payment.amount) || 0);
    }, 0);

    const collected = payments.reduce((sum, payment) => {
      if (payment.status === "Paid") {
        return sum + (Number(payment.amount) || 0);
      }
      return sum;
    }, 0);

    const pending = payments.reduce((sum, payment) => {
      if (payment.status === "Pending") {
        return sum + (Number(payment.amount) || 0);
      }
      return sum;
    }, 0);

    // 7. Send dashboard response
    return res.status(200).json({
      success: true,

      service: {
        id: service._id,
        name: service.serviceName,
      },

      month: selectedMonth,

      customers: {
        total: totalCustomers,
        active: activeCustomers,
        inactive: inactiveCustomers,
      },

      payments: {
        expected,
        collected,
        pending,
        totalPayments: payments.length,
      },

      recentCustomers,
    });
  } catch (error) {
    console.error("Dashboard Summary Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};



export const getCustomers = async (req, res) => {
  try {
    const { serviceId, status } = req.query;

    const filter = {
      tenantId: req.user.tenantId,
    };

    if (serviceId) {
      filter.serviceId = serviceId;
    }

    // Website compatibility:
    // No status parameter = active customers only
    if (!status || status === "active") {
      filter.isActive = true;
    } else if (status === "inactive") {
      filter.isActive = false;
    } else if (status !== "all") {
      return res.status(400).json({
        message: "Invalid customer status",
      });
    }

    const customers = await Customer.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);

    return res.status(500).json({
      message: "Error fetching customers",
    });
  }
};

export const getCustomerHistory = async (req, res) => {
  try {
    const history = await Payment.find({
      tenantId: req.user.tenantId,

      customerId: req.params.id,
    })

      .populate(
        "customerId",
        "name phone doorNumber vehicleName  monthlyAmount",
      )

      .sort({
        createdAt: -1,
      });

    res.json(history);
  } catch {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

export const addCustomer = async (req, res) => {
  try {
    const { month, ...customerData } = req.body;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: "Month is required",
      });
    }

    const newCustomer = await Customer.create({
      ...customerData,
      tenantId: req.user.tenantId,
      welcomeMessageEligible: true,
      welcomeMessageSent: false,
      welcomeMessageSentAt: null,
    });

    // Create initial payment with customer snapshot
    const newPayment = await Payment.create({
      tenantId: req.user.tenantId,
      serviceId: newCustomer.serviceId,
      customerId: newCustomer._id,

      month: month.trim(),

      // Snapshot details
      customerName: newCustomer.name,
      customerPhone: newCustomer.phone,
      customerDoorNumber: newCustomer.doorNumber || "",
      customerVehicleName: newCustomer.vehicleName || "",

      // Original monthly amount
      baseAmount: Number(newCustomer.monthlyAmount),
      amount: Number(newCustomer.monthlyAmount),

      status: "Pending",
      dailyStatus: [],
      missedDays: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customer: newCustomer,
      payment: newPayment,
    });
  } catch (error) {
    console.error("Error adding customer:", error);

    return res.status(500).json({
      success: false,
      message: "Error adding customer",
    });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
      },
      {
        $set: {
          isActive: false,
        },
      },
      {
        new: true,
      },
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer deactivated successfully. Payment history preserved.",
    });
  } catch (error) {
    console.error("Delete Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};


export const togglePayment = async (req, res) => {
  try {
    // 1. Find payment belonging to the logged-in tenant
    const payment = await Payment.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
    });

    // 2. Check payment exists
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // 3. Prevent cancelled payment from being modified
    if (payment.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled payment cannot be changed",
      });
    }

    // 4. Toggle Pending <-> Paid
    if (payment.status === "Pending") {
      payment.status = "Paid";
      payment.paidDate = new Date().toLocaleDateString("en-CA");
    } else if (payment.status === "Paid") {
      payment.status = "Pending";
      payment.paidDate = null;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    // 5. Save updated payment
    await payment.save();

    // 6. Return updated payment
    return res.status(200).json({
      success: true,
      message: `Payment marked as ${payment.status}`,
      payment,
    });
  } catch (error) {
    console.error("Toggle Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update payment",
    });
  }
};



export const getPaymentsByMonth = async (req, res) => {
  try {
    const { month, serviceId } = req.query;
    const tenantId = req.user.tenantId;

    // 1. Validate required fields
    if (!month || !month.trim() || !serviceId) {
      return res.status(400).json({
        success: false,
        message: "Month and Service ID are required",
      });
    }

    const selectedMonth = month.trim();

    // 2. Validate month format (Example: November 2026)
    const monthParts = selectedMonth.split(" ");

    if (monthParts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Invalid month format",
      });
    }

    const [monthName, yearStr] = monthParts;
    const year = Number(yearStr);

    const monthIndex = new Date(
      Date.parse(`${monthName} 1, ${year}`)
    ).getMonth();

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      Number.isNaN(monthIndex)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid month",
      });
    }

    // 3. Verify service belongs to logged-in tenant
    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }


    // Get only ACTIVE customers for the Payments screen.
    // Inactive customers should not appear in current payment lists.
    const existingCustomerIds = await Customer.distinct("_id", {
      tenantId,
      serviceId,
      isActive: true,
    });


    // 5. Fetch valid payments only
    const payments = await Payment.find({
      tenantId,
      serviceId,
      month: selectedMonth,
      status: {
        $in: ["Paid", "Pending"],
      },
      customerId: {
        $in: existingCustomerIds,
      },
    })
      .populate(
        "customerId",
        "name phone doorNumber vehicleName monthlyAmount gender isActive"
      )
      .sort({ createdAt: 1 })
      .lean();

    // 6. Return payments
    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });

  } catch (error) {
    console.error("Get Payments Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching payments",
    });
  }
};


export const getSinglePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,

      tenantId: req.user.tenantId,
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    res.json(payment);
  } catch {
    res.status(500).json({
      message: "Error fetching payment",
    });
  }
};

export const startNewMonth = async (req, res) => {
  try {
    let { month, serviceId } = req.body;

    if (!month) {
      return res.status(400).json({
        message: "Month is required",
      });
    }

    month = month.trim();

    const tenantId = req.user.tenantId;

    // Keep existing website compatibility:
    // If serviceId is provided, sync only that service.
    const customerFilter = {
      tenantId,
      isActive: true,
    };

    const paymentFilter = {
      tenantId,
      month,
    };

    if (serviceId) {
      customerFilter.serviceId = serviceId;
      paymentFilter.serviceId = serviceId;
    }

    const customers = await Customer.find(customerFilter);

    const existingPayments = await Payment.find(paymentFilter);

    const existingCustomerIds = new Set(
      existingPayments.map((payment) => payment.customerId.toString()),
    );

    const newPayments = customers
      .filter((customer) => !existingCustomerIds.has(customer._id.toString()))
      .map((customer) => ({
        tenantId,
        serviceId: customer.serviceId,
        customerId: customer._id,

        month,

        // Snapshot details
        customerName: customer.name,
        customerPhone: customer.phone,
        customerDoorNumber: customer.doorNumber || "",
        customerVehicleName: customer.vehicleName || "",

        // Preserve this month's original amount
        baseAmount: Number(customer.monthlyAmount),
        amount: Number(customer.monthlyAmount),

        status: "Pending",
        dailyStatus: [],
        missedDays: 0,
      }));

    if (newPayments.length > 0) {
      await Payment.insertMany(newPayments);
    }

    return res.json({
      success: true,
      message: "Month synced successfully",
      createdPayments: newPayments.length,
    });
  } catch (error) {
    console.error("Start New Month Error:", error);

    return res.status(500).json({
      message: "Error creating month",
    });
  }
};


export const updateDailyStatus = async (req, res) => {
  try {
    const { paymentId, date, status, month } = req.body;
    const tenantId = req.user.tenantId;

    // 1. Validate required fields
    if (!paymentId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Payment ID, date and status are required",
      });
    }

    // 2. Validate daily status
    const allowedStatuses = ["Cleaned", "Missed", "None"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid daily status",
      });
    }

    // 3. Validate date
    const selectedDate = new Date(date);

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const formattedDate = selectedDate.toISOString().split("T")[0];

    // 4. Find payment and populate customer
    const payment = await Payment.findOne({
      _id: paymentId,
      tenantId,
    }).populate("customerId");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // 5. Prevent cancelled payment updates
    if (payment.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled payment daily status cannot be changed",
      });
    }

    // 6. Update daily status
    const existing = payment.dailyStatus.find(
      (item) => item.date === formattedDate
    );

    if (status === "None") {
      payment.dailyStatus = payment.dailyStatus.filter(
        (item) => item.date !== formattedDate
      );
    } else if (existing) {
      existing.status = status;
    } else {
      payment.dailyStatus.push({
        date: formattedDate,
        status,
      });
    }

    // 7. Recalculate missed days
    const missedDays = payment.dailyStatus.filter(
      (item) => item.status === "Missed"
    ).length;

    payment.missedDays = missedDays;

    // 8. Get target month
    const targetMonth = (month || payment.month).trim();

    const monthParts = targetMonth.split(" ");

    if (monthParts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment month format",
      });
    }

    const [monthName, yearStr] = monthParts;
    const year = Number(yearStr);

    const monthIndex = new Date(
      Date.parse(`${monthName} 1, ${year}`)
    ).getMonth();

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(monthIndex) ||
      Number.isNaN(monthIndex)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment month",
      });
    }

    const daysInMonth = new Date(
      year,
      monthIndex + 1,
      0
    ).getDate();

    // 9. Get monthly amount
    const monthlyAmount =
      Number(payment.baseAmount) ||
      Number(payment.customerId?.monthlyAmount) ||
      0;

    if (monthlyAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid monthly amount",
      });
    }

    // 10. Backfill old payment snapshots when possible
    if (!payment.baseAmount && monthlyAmount > 0) {
      payment.baseAmount = monthlyAmount;
    }

    if (!payment.customerName && payment.customerId) {
      payment.customerName = payment.customerId.name || "";
    }

    if (!payment.customerPhone && payment.customerId) {
      payment.customerPhone = payment.customerId.phone || "";
    }

    if (!payment.customerDoorNumber && payment.customerId) {
      payment.customerDoorNumber =
        payment.customerId.doorNumber || "";
    }

    if (!payment.customerVehicleName && payment.customerId) {
      payment.customerVehicleName =
        payment.customerId.vehicleName || "";
    }

    // 11. Calculate final amount
    const perDay = monthlyAmount / daysInMonth;

    let finalAmount = Math.round(
      monthlyAmount - missedDays * perDay
    );

    finalAmount = Math.max(0, finalAmount);

    payment.amount = finalAmount;

    // 12. Save payment
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Daily status updated successfully",
      payment,
    });

  } catch (error) {
    console.error("Error updating daily status:", error);

    return res.status(500).json({
      success: false,
      message: "Error updating daily status",
    });
  }
};


export const updateCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      doorNumber,
      vehicleName,
      monthlyAmount,
      gender,
      month,
    } = req.body;

    console.log("========== UPDATE CUSTOMER API ==========");
    console.log("CUSTOMER ID:", req.params.id);
    console.log("BODY:", req.body);
    console.log("TENANT ID:", req.user?.tenantId);

    const tenantId = req.user.tenantId;

    // 1. Validate month
    const validMonth = typeof month === "string" ? month.trim() : "";

    const monthMatch = validMonth.match(
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s(\d{4})$/,
    );

    if (!monthMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing month",
      });
    }

    const monthName = monthMatch[1];
    const year = Number(monthMatch[2]);

    const monthIndex = new Date(
      Date.parse(`${monthName} 1, ${year}`),
    ).getMonth();

    if (Number.isNaN(monthIndex)) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing month",
      });
    }

    // 2. Validate amount
    const amount = Number(monthlyAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid monthly amount",
      });
    }

    // 3. Find customer
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // 4. Find current month's pending payment
    const payment = await Payment.findOne({
      tenantId,
      serviceId: customer.serviceId,
      customerId: customer._id,
      month: validMonth,
      status: "Pending",
    });

    // 5. Update customer details
    customer.name = name;
    customer.phone = phone;
    customer.doorNumber = doorNumber || "";
    customer.vehicleName = vehicleName || "";
    customer.monthlyAmount = amount;
    customer.gender = gender || customer.gender;

    await customer.save();

    // 6. Update only pending payment
    if (payment) {
      payment.customerName = customer.name;
      payment.customerPhone = customer.phone;
      payment.customerDoorNumber = customer.doorNumber;
      payment.customerVehicleName = customer.vehicleName;

      payment.baseAmount = amount;

      // Preserve missed-day adjustment
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      const missedDays = Number(payment.missedDays) || 0;

      const safeMissedDays = Math.min(missedDays, daysInMonth);

      const perDay = amount / daysInMonth;

      payment.amount = Math.max(
        0,
        Math.round(amount - safeMissedDays * perDay),
      );

      await payment.save();
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
      paymentUpdated: Boolean(payment),
      payment,
    });
  } catch (error) {
    console.error("Update Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Update failed",
    });
  }
};


export const getGlobalHistory = async (req, res) => {
  try {
    const { serviceId } = req.query;
    const tenantId = req.user.tenantId;

    // 1. Validate service ID
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    // 2. Verify service belongs to logged-in tenant
    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // 3. Fetch all payment history.
    // Do not filter by existing customers.
    // Deleted and inactive customer payment history must be preserved.
    const payments = await Payment.find({
      tenantId,
      serviceId,
    })
      .populate(
        "customerId",
        "name phone doorNumber vehicleName gender isActive",
      )
      .sort({ createdAt: -1 })
      .lean();

    // 4. Group payments month-wise
    const groupedHistory = {};

    payments.forEach((payment) => {
      const month = payment.month;

      if (!groupedHistory[month]) {
        groupedHistory[month] = {
          month,
          collected: 0,
          pending: 0,
          cancelled: 0,
          totalPayments: 0,
          payments: [],
        };
      }

      // Keep every payment in history,
      // including payments whose customer document was deleted.
      groupedHistory[month].payments.push(payment);

      const amount = Number(payment.amount) || 0;

      // Count only valid payment statuses
      if (payment.status === "Paid") {
        groupedHistory[month].collected += amount;
      } else if (payment.status === "Pending") {
        groupedHistory[month].pending += amount;
      } else if (payment.status === "Cancelled") {
        groupedHistory[month].cancelled += amount;
      }

      groupedHistory[month].totalPayments += 1;
    });

    // 5. Return month-wise history
    return res.status(200).json({
      success: true,
      history: Object.values(groupedHistory),
    });
  } catch (error) {
    console.error("Global History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch global history",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};


export const markWelcomeSent = async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceId } = req.body;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    const customer = await Customer.findOneAndUpdate(
      {
        _id: id,
        tenantId: req.user.tenantId,
        serviceId,
      },
      {
        $set: {
          welcomeMessageSent: true,
          welcomeMessageSentAt: new Date(),
        },
      },
      { new: true },
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Welcome status updated",
      customer,
    });
  } catch (error) {
    console.error("Welcome status error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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

    if (!serviceId || !month) {
      return res.status(400).json({
        message: "Service ID and month are required",
      });
    }

    // Verify this service belongs to the logged-in tenant
    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const paymentFilter = {
      tenantId,
      serviceId,
      month: month.trim(),
    };

    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      payments,
      recentCustomers,
    ] = await Promise.all([
      Customer.countDocuments({ tenantId, serviceId }),

      Customer.countDocuments({
        tenantId,
        serviceId,
        isActive: true,
      }),

      Customer.countDocuments({
        tenantId,
        serviceId,
        isActive: false,
      }),

      Payment.find(paymentFilter).select("amount status"),

      Customer.find({
        tenantId,
        serviceId,
        isActive: true,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name phone vehicleName monthlyAmount isActive"),
    ]);

    const expected = payments.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );

    const collected = payments
      .filter((payment) => payment.status === "Paid")
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const pending = payments
      .filter((payment) => payment.status === "Pending")
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    return res.status(200).json({
      success: true,
      service: {
        id: service._id,
        name: service.serviceName,
      },
      month: month.trim(),
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
      message: "Failed to fetch dashboard summary",
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
    await Customer.findOneAndDelete({
      _id: req.params.id,

      tenantId: req.user.tenantId,
    });

    res.json({
      message: "Deleted",
    });
  } catch {
    res.status(500).json({
      message: "Delete failed",
    });
  }
};

export const togglePayment = async (req, res) => {
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
    res.status(500).json({
      message: "Toggle failed",
    });
  }
};

export const getPaymentsByMonth = async (req, res) => {
  try {
    const { month, serviceId } = req.query;
    const tenantId = req.user.tenantId;

    if (!month || !serviceId) {
      return res.status(400).json({
        success: false,
        message: "Month and Service ID are required",
      });
    }

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

    const payments = await Payment.find({
      tenantId,
      serviceId,
      month: month.trim(),
    })
      .populate(
        "customerId",
        "name phone doorNumber vehicleName monthlyAmount gender isActive serviceId",
      )
      .sort({ createdAt: 1 });

    res.status(200).json(payments);
  } catch (error) {
    console.error("Get Payments Error:", error);

    res.status(500).json({
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
    let { paymentId, date, status, month } = req.body;

    const payment = await Payment.findOne({
      _id: paymentId,

      tenantId: req.user.tenantId,
    }).populate("customerId");

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    const formattedDate = new Date(date).toISOString().split("T")[0];

    const existing = payment.dailyStatus.find((d) => d.date === formattedDate);

    if (status === "None") {
      payment.dailyStatus = payment.dailyStatus.filter(
        (d) => d.date !== formattedDate,
      );
    } else {
      if (existing) {
        existing.status = status;
      } else {
        payment.dailyStatus.push({
          date: formattedDate,
          status,
        });
      }
    }

    const missedDays = payment.dailyStatus.filter(
      (d) => d.status === "Missed",
    ).length;

    payment.missedDays = missedDays;

    let targetMonth = month || payment.month;

    const [monthName, yearStr] = targetMonth.trim().split(" ");

    const year = parseInt(yearStr);

    const monthIndex = new Date(
      Date.parse(`${monthName} 1, ${year}`),
    ).getMonth();

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const monthlyAmount =
      Number(payment.baseAmount) ||
      Number(payment.customerId?.monthlyAmount) ||
      0;

    // Backfill snapshot for older payment records when possible
    if (!payment.baseAmount) {
      payment.baseAmount = monthlyAmount;
    }

    if (!payment.customerName && payment.customerId) {
      payment.customerName = payment.customerId.name || "";
    }

    if (!payment.customerPhone && payment.customerId) {
      payment.customerPhone = payment.customerId.phone || "";
    }

    if (!payment.customerDoorNumber && payment.customerId) {
      payment.customerDoorNumber = payment.customerId.doorNumber || "";
    }

    if (!payment.customerVehicleName && payment.customerId) {
      payment.customerVehicleName = payment.customerId.vehicleName || "";
    }

    const perDay = monthlyAmount / daysInMonth;

    let finalAmount = Math.round(monthlyAmount - missedDays * perDay);

    finalAmount = Math.max(0, finalAmount);

    payment.amount = finalAmount;

    await payment.save();

    res.json(payment);
  } catch (error) {
    console.error("Error updating daily status:", error);

    res.status(500).json({
      message: "Error updating daily status",
    });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { name, phone, doorNumber, vehicleName, monthlyAmount, gender } =
      req.body;

    const updatedCustomer = await Customer.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
      },
      {
        name,
        phone,
        doorNumber,
        vehicleName,
        monthlyAmount,
        gender,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Update Customer Error:", error);

    res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
};

export const getGlobalHistory = async (req, res) => {
  try {
    const { serviceId } = req.query;
    const tenantId = req.user.tenantId;

    if (!serviceId) {
      return res.status(400).json({
        message: "Service ID is required",
      });
    }

    const service = await Service.findOne({
      _id: serviceId,
      tenantId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const payments = await Payment.find({
      tenantId,
      serviceId,
    })
      .populate("customerId")
      .sort({ createdAt: -1 });

    const groupedHistory = {};

    payments.forEach((payment) => {
      if (!groupedHistory[payment.month]) {
        groupedHistory[payment.month] = {
          month: payment.month,
          collected: 0,
          pending: 0,
          payments: [],
        };
      }

      groupedHistory[payment.month].payments.push(payment);

      if (payment.status === "Paid") {
        groupedHistory[payment.month].collected += Number(payment.amount) || 0;
      } else {
        groupedHistory[payment.month].pending += Number(payment.amount) || 0;
      }
    });

    return res.json(Object.values(groupedHistory));
  } catch (error) {
    console.error("Global History Error:", error);

    res.status(500).json({
      message: "Failed to fetch global history",
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


import Service from "../models/Service.js";

// GET ACTIVE SERVICES
export const getServices = async (req, res) => {
  try {
    const services = await Service.find({
      tenantId: req.user.tenantId,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Get services error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};

// CREATE SERVICE
export const createService = async (req, res) => {
  try {
    const { serviceName, monthlyPrice, description } = req.body;

    if (!serviceName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    const price = Number(monthlyPrice ?? 0);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid monthly price",
      });
    }

    const service = await Service.create({
      tenantId: req.user.tenantId,
      serviceName: serviceName.trim(),
      monthlyPrice: price,
      description: description?.trim() || "",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create service",
    });
  }
};

// UPDATE SERVICE
export const updateService = async (req, res) => {
  try {
    const { serviceName, monthlyPrice, description } = req.body;

    const service = await Service.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (
      serviceName !== undefined &&
      !String(serviceName).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Service name cannot be empty",
      });
    }

    if (serviceName !== undefined) {
      service.serviceName = String(serviceName).trim();
    }

    if (monthlyPrice !== undefined) {
      const price = Number(monthlyPrice);

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid monthly price",
        });
      }

      service.monthlyPrice = price;
    }

    if (description !== undefined) {
      service.description = String(description).trim();
    }

    await service.save();

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update service",
    });
  }
};

// SOFT DELETE SERVICE
export const deleteService = async (req, res) => {
  try {
    const service = await Service.findOneAndUpdate(
      {
        _id: req.params.id,
        tenantId: req.user.tenantId,
        isActive: true,
      },
      {
        $set: { isActive: false },
      },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error);

    return res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};

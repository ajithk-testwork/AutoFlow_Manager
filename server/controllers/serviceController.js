import Service from "../models/Service.js";

export const getServices = async (
  req,
  res
) => {

  try {

    const services =
      await Service.find({

        tenantId: req.user.tenantId,

        isActive: true

      });

    res.json(services);

  } catch {

    res.status(500).json({
      message: "Failed to fetch services"
    });

  }

};


export const createService = async (req, res) => {
  try {
    const service = await Service.create({
        ...req.body,
        tenantId: req.user.tenantId
    });
    res.status(201).json(service);
  } catch (error) {
    // ADD CONSOLE LOG HERE to see the exact mongoose validation error in your terminal
    console.error("Error creating service:", error); 
    
    res.status(500).json({
      message: "Failed to create service",
      error: error.message // <--- Send the error message to the frontend for debugging
    });
  }
};

export const deleteService = async (
  req,
  res
) => {

  try {

    await Service.findOneAndUpdate(

      {
        _id: req.params.id,

        tenantId: req.user.tenantId
      },

      {
        isActive: false
      }

    );

    res.json({
      message: "Service deleted"
    });

  } catch {

    res.status(500).json({
      message: "Delete failed"
    });

  }

};
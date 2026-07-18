import Godown from "../models/godown.js";

export const createGodown = async (req, res) => {
  try {
    const godown = await Godown.create(req.body);

    res.status(201).json({
      message: "Godown created successfully",
      data: godown
    });
  } catch (error) {
    console.error("Create Godown Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllGodowns = async (req, res) => {
  try {
    const godowns = await Godown.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "Godowns fetched successfully",
      data: godowns
    });
  } catch (error) {
    console.error("Get Godowns Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

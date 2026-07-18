import Branch from "../models/branch.js";

export const createBranch = async (req, res) => {
  try {
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json({ success: true, message: "Branch created successfully", branch });
  } catch (error) {
    console.error("Branch creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllBranches = async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json({ success: true, count: branches.length, branches });
  } catch (error) {
    console.error("Get branches error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBranchById = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
    res.status(200).json({ success: true, branch });
  } catch (error) {
    console.error("Get branch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const { _id, createdAt, updatedAt, __v, ...updateData } = req.body;
    const updatedBranch = await Branch.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedBranch)
      return res.status(404).json({ success: false, message: "Branch not found" });

    res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      branch: updatedBranch,
    });
  } catch (error) {
    console.error("Update branch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const deleteBranch = async (req, res) => {
  try {
    const deletedBranch = await Branch.findByIdAndDelete(req.params.id);
    if (!deletedBranch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    res.status(200).json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    console.error("Delete branch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a controller function to delete all branches
export const deleteAllBranches = async (req, res) => {
  try {
    await Branch.deleteMany();
    res.status(200).json({ success: true, message: "All branches deleted successfully" });
  } catch (error) {
    console.error("Delete all branches error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
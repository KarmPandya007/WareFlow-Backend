import express from "express";
import {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  deleteAllBranches,
} from "../controllers/branchController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import Branch from "../models/branch.js";

const router = express.Router();

// GET /api/branches - Get all branches
router.get("/", protect, getAllBranches);

// GET /api/branches/:id - Get branch by ID
router.get("/:id", protect, getBranchById);

// POST /api/branches - Create new branch (admin only)
router.post("/", protect, authorizeRoles("admin"), createBranch);

// PUT /api/branches/:id - Update branch (admin only)
router.put("/:id", protect, authorizeRoles("admin"), updateBranch);

// DELETE /api/branches/:id - Delete branch (admin only)
router.delete("/:id", protect, authorizeRoles("admin"), deleteBranch);

// DELETE /api/branches - Delete all branches (admin only)
router.delete("/", protect, authorizeRoles("admin"), deleteAllBranches);

// POST /api/branches/init - Initialize sample branches (development only)
router.post("/init", async (req, res) => {
  try {
    const existingBranches = await Branch.find();
    
    if (existingBranches.length > 0) {
      return res.status(200).json({ 
        success: true, 
        message: "Branches already exist", 
        count: existingBranches.length,
        branches: existingBranches 
      });
    }
    
    const sampleBranches = [
      { name: 'Main Branch', code: 'MB001', location: 'Delhi', contact: '9876543210' },
      { name: 'North Branch', code: 'NB002', location: 'Gurgaon', contact: '9876543211' },
      { name: 'South Branch', code: 'SB003', location: 'Noida', contact: '9876543212' }
    ];
    
    const createdBranches = [];
    for (const branchData of sampleBranches) {
      const branch = new Branch(branchData);
      await branch.save();
      createdBranches.push(branch);
    }
    
    res.status(201).json({ 
      success: true, 
      message: "Sample branches created successfully", 
      count: createdBranches.length,
      branches: createdBranches 
    });
  } catch (error) {
    console.error("Init branches error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


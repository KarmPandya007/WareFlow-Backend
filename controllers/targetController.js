import Target from "../models/target.js";
import User from "../models/User.js";
import Billing from "../models/billing.js";
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import fs from "fs";

// Helper function to calculate target progress
export const calculateProgress = async (target) => {
  if (target.targetType === "billing_count") {
    const count = await Billing.countDocuments({
      salesPerson: target.user,
      createdAt: { $gte: target.startDate, $lte: target.endDate },
    });
    target.currentValue = count;
  } else if (target.targetType === "billing_amount") {
    const result = await Billing.aggregate([
      {
        $match: {
          salesPerson: new mongoose.Types.ObjectId(target.user),
          createdAt: { $gte: target.startDate, $lte: target.endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    target.currentValue = result.length > 0 ? result[0].total : 0;
  } else if (target.targetType === "product_based") {
    for (let i = 0; i < target.productTargets.length; i++) {
      const productTarget = target.productTargets[i];
      const count = await Billing.aggregate([
        {
          $match: {
            salesPerson: new mongoose.Types.ObjectId(target.user),
            createdAt: { $gte: target.startDate, $lte: target.endDate },
          },
        },
        { $unwind: "$products" },
        {
          $lookup: {
            from: "products",
            localField: "products",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $match: {
            "productDetails.category": productTarget.category,
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ]);
      target.productTargets[i].currentValue = count.length > 0 ? count[0].count : 0;
    }
    target.markModified('productTargets');
    
    const allTargetsMet = target.productTargets.every(
      (pt) => pt.currentValue >= pt.targetValue
    );
    target.status = allTargetsMet ? "completed" : "active";
  }

  if (target.targetType !== "product_based") {
    target.status = target.currentValue >= target.targetValue ? "completed" : "active";
  }

  await target.save();
};

// CREATE TARGET
export const createTarget = async (req, res) => {
  try {
    const { userId, targetType, targetValue, period, startDate, endDate, productTargets, incentiveAmount } = req.body;

    if (!userId || !targetType || !period || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "userId, targetType, period, startDate, and endDate are required",
      });
    }

    if (targetType === "product_based") {
      if (!productTargets || !Array.isArray(productTargets) || productTargets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "productTargets array is required for product_based targets",
        });
      }
    } else {
      if (!targetValue) {
        return res.status(400).json({
          success: false,
          message: "targetValue is required for non-product targets",
        });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "sales_person") {
      return res.status(400).json({
        success: false,
        message: "Targets can only be assigned to sales persons",
      });
    }

    const target = await Target.create({
      user: userId,
      assignedBy: req.user._id,
      targetType,
      targetValue: targetValue || 0,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      productTargets: productTargets || [],
      incentiveAmount: incentiveAmount || 0,
    });

    // Calculate initial progress from existing billings
    await calculateProgress(target);

    const populated = await Target.findById(target._id)
      .populate("user", "firstName lastName email")
      .populate("assignedBy", "firstName lastName");

    res.status(201).json({
      success: true,
      message: "Target created successfully",
      target: populated,
    });
  } catch (error) {
    console.error("Create target error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL TARGETS
export const getAllTargets = async (req, res) => {
  try {
    const targets = await Target.find()
      .populate("user", "firstName lastName email")
      .populate("assignedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    for (const target of targets) {
      await calculateProgress(target);
    }

    const updatedTargets = await Target.find()
      .populate("user", "firstName lastName email")
      .populate("assignedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: updatedTargets.length,
      targets: updatedTargets,
    });
  } catch (error) {
    console.error("Get all targets error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET MY TARGETS (Sales Person)
export const getMyTargets = async (req, res) => {
  try {
    const targets = await Target.find({ user: req.user._id })
      .populate("assignedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    // Recalculate progress for each target
    for (const target of targets) {
      await calculateProgress(target);
    }

    // Fetch updated targets
    const updatedTargets = await Target.find({ user: req.user._id })
      .populate("assignedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: updatedTargets.length,
      targets: updatedTargets,
    });
  } catch (error) {
    console.error("Get my targets error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE TARGET
export const updateTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetType, targetValue, period, startDate, endDate, productTargets, incentiveAmount } = req.body;

    const target = await Target.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "Target not found" });
    }

    if (targetValue !== undefined) target.targetValue = targetValue;
    if (targetType) target.targetType = targetType;
    if (period) target.period = period;
    if (startDate) target.startDate = new Date(startDate);
    if (endDate) target.endDate = new Date(endDate);
    if (productTargets !== undefined) target.productTargets = productTargets;
    if (incentiveAmount !== undefined) target.incentiveAmount = incentiveAmount;

    await target.save();

    const populated = await Target.findById(target._id)
      .populate("user", "firstName lastName email")
      .populate("assignedBy", "firstName lastName");

    res.status(200).json({
      success: true,
      message: "Target updated successfully",
      target: populated,
    });
  } catch (error) {
    console.error("Update target error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE TARGET
export const deleteTarget = async (req, res) => {
  try {
    const { id } = req.params;

    const target = await Target.findByIdAndDelete(id);
    
    if (!target) {
      return res.status(404).json({ success: false, message: "Target not found" });
    }

    res.status(200).json({
      success: true,
      message: "Target deleted successfully",
    });
  } catch (error) {
    console.error("Delete target error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL SALES PERSONS
export const getAllSalesPersons = async (req, res) => {
  try {
    const salesPersons = await User.find({ role: "sales_person", status: "active" })
      .select("firstName lastName email phone employmentId")
      .sort({ firstName: 1 });

    res.status(200).json({
      success: true,
      count: salesPersons.length,
      salesPersons,
    });
  } catch (error) {
    console.error("Get sales persons error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// BULK UPLOAD TARGETS FROM EXCEL
export const bulkUploadTargets = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    const results = { success: [], failed: [] };

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      try {
        const getCleanCellValue = (cell) => {
          if (!cell || cell.value === null || cell.value === undefined) return "";
          if (typeof cell.value === "object") {
            return cell.value.result !== undefined ? cell.value.result : (cell.value.text || "");
          }
          return cell.value.toString().trim();
        };

        const salespersonName = getCleanCellValue(row.getCell(1)); // Column A
        const email = getCleanCellValue(row.getCell(2)); // Column B
        const targetType = getCleanCellValue(row.getCell(3)); // Column C
        const targetValue = getCleanCellValue(row.getCell(4)); // Column D
        const period = getCleanCellValue(row.getCell(8)); // Column H
        const startDate = getCleanCellValue(row.getCell(9)); // Column I
        const endDate = getCleanCellValue(row.getCell(10)); // Column J
        const incentiveAmount = parseFloat(getCleanCellValue(row.getCell(11))) || 0; // Column K

        if (!email || !targetType || !period || !startDate || !endDate) {
          results.failed.push({ row: i, reason: "Missing required fields" });
          continue;
        }

        const user = await User.findOne({ email, role: "sales_person" });
        if (!user) {
          results.failed.push({ row: i, reason: "Sales person not found" });
          continue;
        }

        // Handle product-based targets
        let productTargets = [];
        if (targetType.toLowerCase().includes('product-based')) {
          const category = targetType.split(' - ')[1]?.toLowerCase();
          if (category) {
            productTargets = [{
              category: category,
              targetValue: targetValue || 0,
              currentValue: 0
            }];
          }
        }

        const target = await Target.create({
          user: user._id,
          assignedBy: req.user._id,
          targetType: targetType.toLowerCase().includes('product-based') ? 'product_based' : 
                     targetType.toLowerCase().replace(' ', '_'),
          targetValue: targetType.toLowerCase().includes('product-based') ? 0 : (targetValue || 0),
          period: period.toLowerCase(),
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          incentiveAmount,
          productTargets
        });

        await calculateProgress(target);
        results.success.push({ row: i, targetId: target._id, salesperson: salespersonName });
      } catch (error) {
        results.failed.push({ row: i, reason: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk upload completed",
      results,
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

import Billing from "../models/billing.js";
import Branch from "../models/branch.js";
import User from "../models/User.js";
import mongoose from "mongoose";

import Product from "../models/product.js";

// Helper to escape user-provided strings for RegExp
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------
// DASHBOARD: TOTALS
// ---------------------------
export const getDashboardTotals = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday as start
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totals = {
      today: await Billing.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
      ]),
      week: await Billing.aggregate([
        { $match: { createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
      ]),
      month: await Billing.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
      ]),
    };

    res.status(200).json({ success: true, totals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------
// BRANCH-WISE PERFORMANCE
// ---------------------------
export const getBranchPerformance = async (req, res) => {
  try {
    const performance = await Billing.aggregate([
      { $group: { _id: "$branch", totalAmount: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branch",
        },
      },
      { $unwind: "$branch" },
      { $project: { branchName: "$branch.name", branchCode: "$branch.code", totalAmount: 1, count: 1 } },
    ]);

    res.status(200).json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------
// SALES PERSON PERFORMANCE
// ---------------------------
export const getSalesPersonPerformance = async (req, res) => {
  try {
    const performance = await Billing.aggregate([
      { $group: { _id: "$salesPerson", totalAmount: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "salesPerson",
        },
      },
      { $unwind: "$salesPerson" },
      { $project: { name: { $concat: ["$salesPerson.firstName", " ", "$salesPerson.lastName"] }, totalAmount: 1, count: 1 } },
    ]);

    res.status(200).json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------
// RECENT ACTIVITIES
// ---------------------------
export const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activities = await Billing.find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate("salesPerson", "firstName lastName")
      .populate("branch", "name code")
      .populate("products");

    res.status(200).json({ success: true, activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------
// FILTER BILLINGS
// ---------------------------
export const getFilteredBillings = async (req, res) => {
  try {
    const { branch, salesPerson, from, to, paymentMode, customerName, minAmount, maxAmount } = req.query;

    const filter = {};
    if(branch) filter.branch = new mongoose.Types.ObjectId(branch);
    if(salesPerson) filter.salesPerson = new mongoose.Types.ObjectId(salesPerson);
    if(from || to) filter.createdAt = {};
    if(from) filter.createdAt.$gte = new Date(from);
    if(to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
    if(paymentMode) filter.paymentMode = paymentMode;
    if(customerName) filter.customerName = { $regex: escapeRegExp(customerName), $options: "i" };
    if(minAmount || maxAmount) filter.totalAmount = {};
    if(minAmount) filter.totalAmount.$gte = Number(minAmount);
    if(maxAmount) filter.totalAmount.$lte = Number(maxAmount);

    const billings = await Billing.find(filter)
      .populate("branch", "name code")
      .populate("salesPerson", "firstName lastName");

    res.status(200).json({ success: true, count: billings.length, billings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getProductWiseReport = async (req, res) => {
  try {
    // Unwind products array to get each product individually
    const report = await Billing.aggregate([
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.name",
          totalSold: { $sum: 1 },
          totalAmount: { $sum: "$product.price" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------
// PAYMENT MODE ANALYSIS
// ---------------------------
export const getPaymentModeAnalysis = async (req, res) => {
  try {
    const analysis = await Billing.aggregate([
      {
        $group: {
          _id: "$paymentMode",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// ---------------------------
// CUSTOM DATE RANGE REPORT
// ---------------------------
export const getCustomReport = async (req, res) => {
  try {
    const {
      branch,        // Branch ID
      salesPerson,   // User ID
      startDate,     // e.g., "2025-10-01"
      endDate,       // e.g., "2025-10-21"
      paymentMode,   // "Cash", "Card", etc.
      minAmount,     // Minimum totalAmount
      maxAmount,     // Maximum totalAmount
      productId,     // Filter by specific product
    } = req.query;

    // Build dynamic filter
    const filter = {};

    if (branch) filter.branch = new mongoose.Types.ObjectId(branch);
    if (salesPerson) filter.salesPerson = new mongoose.Types.ObjectId(salesPerson);
    if (paymentMode) filter.paymentMode = paymentMode;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    if (minAmount || maxAmount) {
      filter.totalAmount = {};
      if (minAmount) filter.totalAmount.$gte = Number(minAmount);
      if (maxAmount) filter.totalAmount.$lte = Number(maxAmount);
    }

    let aggregatePipeline = [{ $match: filter }];

    // Filter by product if provided
    if (productId) {
      aggregatePipeline.push({ $match: { products: new mongoose.Types.ObjectId(productId) } });
    }

    // Populate branch and sales person info
    aggregatePipeline.push(
      { $lookup: { from: "branches", localField: "branch", foreignField: "_id", as: "branch" } },
      { $unwind: "$branch" },
      { $lookup: { from: "users", localField: "salesPerson", foreignField: "_id", as: "salesPerson" } },
      { $unwind: "$salesPerson" }
    );

    // Project necessary fields
    aggregatePipeline.push({
      $project: {
        customerName: 1,
        totalAmount: 1,
        paymentMode: 1,
        date: 1,
        "branch.name": 1,
        "branch.code": 1,
        "salesPerson.firstName": 1,
        "salesPerson.lastName": 1,
      },
    });

    const report = await Billing.aggregate(aggregatePipeline);

    res.status(200).json({ success: true, count: report.length, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

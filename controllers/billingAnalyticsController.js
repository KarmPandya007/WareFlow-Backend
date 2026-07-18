import Billing from "../models/billing.js";
import mongoose from "mongoose";

// GET DAILY BILLING TRENDS
export const getDailyTrends = async (req, res) => {
  try {
    const { branchId, startDate, endDate, userId } = req.query;

    const filter = {};
    if (branchId) filter.branch = new mongoose.Types.ObjectId(branchId);
    if (userId) filter.salesPerson = new mongoose.Types.ObjectId(userId);
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const dailyData = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          count: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      success: true,
      branchId: branchId || "all",
      data: dailyData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch daily trends", error: error.message });
  }
};

// GET DEVICE/CATEGORY BREAKDOWN
export const getDeviceBreakdown = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {};
    if (branchId) filter.branch = new mongoose.Types.ObjectId(branchId);

    const deviceData = await Billing.aggregate([
      { $match: filter },
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
        $group: {
          _id: "$productDetails.category",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      success: true,
      branchId: branchId || "all",
      data: deviceData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch device breakdown", error: error.message });
  }
};

// GET BRANCH SUMMARY
export const getBranchSummary = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {};
    if (branchId) filter.branch = new mongoose.Types.ObjectId(branchId);

    const summary = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBillings: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          avgBillingAmount: { $avg: "$totalAmount" },
        },
      },
    ]);

    const result = summary.length > 0 ? summary[0] : { totalBillings: 0, totalRevenue: 0, avgBillingAmount: 0 };
    delete result._id;

    res.json({
      success: true,
      branchId: branchId || "all",
      summary: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch branch summary", error: error.message });
  }
};

// GET BRANCHES COMPARISON
export const getBranchesComparison = async (req, res) => {
  try {
    const branchData = await Billing.aggregate([
      {
        $group: {
          _id: "$branch",
          totalBillings: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          avgBillingAmount: { $avg: "$totalAmount" },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branchDetails",
        },
      },
      { $unwind: "$branchDetails" },
      {
        $project: {
          branchId: "$_id",
          branchName: "$branchDetails.name",
          branchCode: "$branchDetails.code",
          totalBillings: 1,
          totalRevenue: 1,
          avgBillingAmount: 1,
          _id: 0,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.json({
      success: true,
      data: branchData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch branches comparison", error: error.message });
  }
};

// GET MONTHLY TRENDS
export const getMonthlyTrends = async (req, res) => {
  try {
    const { branchId, year } = req.query;

    const filter = {};
    if (branchId) filter.branch = new mongoose.Types.ObjectId(branchId);
    if (year) {
      filter.date = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      };
    }

    const monthlyData = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          month: "$_id",
          count: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      success: true,
      branchId: branchId || "all",
      year: year || new Date().getFullYear(),
      data: monthlyData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch monthly trends", error: error.message });
  }
};

// GET PAYMENT MODE BREAKDOWN
export const getPaymentModeBreakdown = async (req, res) => {
  try {
    const { branchId } = req.query;

    const filter = {};
    if (branchId) filter.branch = new mongoose.Types.ObjectId(branchId);

    const paymentData = await Billing.aggregate([
      { $match: filter },
      { $unwind: "$paymentMode" },
      {
        $group: {
          _id: "$paymentMode.mode",
          count: { $sum: 1 },
          totalAmount: { $sum: "$paymentMode.amount" },
        },
      },
      {
        $project: {
          mode: "$_id",
          count: 1,
          totalAmount: 1,
          _id: 0,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({
      success: true,
      branchId: branchId || "all",
      data: paymentData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch payment mode breakdown", error: error.message });
  }
};

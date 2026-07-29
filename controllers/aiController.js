import { GoogleGenAI } from "@google/genai";
import Billing from "../models/billing.js";
import User from "../models/User.js";
import Target from "../models/target.js";

// Lazily initialised so dotenv has already run before the key is read
let _ai = null;
function getAI() {
  if (!_ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables.");
    _ai = new GoogleGenAI({ apiKey: key });
  }
  return _ai;
}

// ── Tool Implementations (internal data fetchers) ─────────────────────────────

async function tool_getDashboardTotals() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, week, month] = await Promise.all([
    Billing.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
    ]),
    Billing.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
    ]),
    Billing.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
    ]),
  ]);

  return {
    today: today[0] ?? { count: 0, totalAmount: 0 },
    week: week[0] ?? { count: 0, totalAmount: 0 },
    month: month[0] ?? { count: 0, totalAmount: 0 },
  };
}

async function tool_getBranchPerformance() {
  return Billing.aggregate([
    { $group: { _id: "$branch", totalAmount: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "branch" } },
    { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        branchName: { $ifNull: ["$branch.name", "Unknown Branch"] },
        branchCode: { $ifNull: ["$branch.code", "N/A"] },
        totalAmount: 1,
        count: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);
}

async function tool_getSalesPersonPerformance() {
  return Billing.aggregate([
    { $group: { _id: "$salesPerson", totalAmount: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
        totalAmount: 1,
        count: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);
}

async function tool_getProductCategoryBreakdown() {
  return Billing.aggregate([
    { $unwind: "$products" },
    { $lookup: { from: "products", localField: "products", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    {
      $group: {
        _id: "$product.category",
        count: { $sum: 1 },
        totalAmount: { $sum: "$product.price" },
      },
    },
    { $project: { _id: 0, category: "$_id", count: 1, totalAmount: 1 } },
    { $sort: { count: -1 } },
  ]);
}

async function tool_getMonthlyTrends({ year }) {
  const currentYear = year || new Date().getFullYear();
  return Billing.aggregate([
    {
      $match: {
        date: {
          $gte: new Date(`${currentYear}-01-01`),
          $lte: new Date(`${currentYear}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, month: "$_id", count: 1, totalAmount: 1 } },
  ]);
}

async function tool_getPaymentModeBreakdown() {
  return Billing.aggregate([
    { $unwind: "$paymentMode" },
    {
      $group: {
        _id: "$paymentMode.mode",
        count: { $sum: 1 },
        totalAmount: { $sum: "$paymentMode.amount" },
      },
    },
    { $project: { _id: 0, mode: "$_id", count: 1, totalAmount: 1 } },
    { $sort: { totalAmount: -1 } },
  ]);
}

async function tool_getAllTargets() {
  const targets = await Target.find()
    .populate("user", "firstName lastName")
    .populate("assignedBy", "firstName lastName")
    .sort({ createdAt: -1 });

  return targets.map((t) => ({
    user: `${t.user?.firstName ?? ""} ${t.user?.lastName ?? ""}`.trim(),
    targetType: t.targetType,
    targetValue: t.targetValue,
    currentValue: t.currentValue,
    status: t.status,
    period: t.period,
    startDate: t.startDate,
    endDate: t.endDate,
    incentiveAmount: t.incentiveAmount,
  }));
}

async function tool_getTopProducts({ category, limit = 10 } = {}) {
  const matchStage = category && typeof category === "string" && category.trim().length > 0
    ? { "product.category": new RegExp(`^${category.trim()}$`, "i") }
    : {};

  return Billing.aggregate([
    { $unwind: "$products" },
    { $lookup: { from: "products", localField: "products", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $match: matchStage },
    {
      $group: {
        _id: { name: "$product.name", model: "$product.model", category: "$product.category" },
        unitsSold: { $sum: 1 },
        totalRevenue: { $sum: "$product.price" },
      },
    },
    {
      $project: {
        _id: 0,
        name: "$_id.name",
        model: "$_id.model",
        category: "$_id.category",
        unitsSold: 1,
        totalRevenue: 1,
      },
    },
    { $sort: { unitsSold: -1, totalRevenue: -1 } },
    { $limit: limit },
  ]);
}

async function tool_getTopCustomers({ limit = 10 } = {}) {
  return Billing.aggregate([
    {
      $group: {
        _id: "$customerName",
        mobile: { $first: "$mobile" },
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" },
        lastOrderDate: { $max: "$date" },
      },
    },
    {
      $project: {
        _id: 0,
        customerName: "$_id",
        mobile: 1,
        orderCount: 1,
        totalSpent: 1,
        lastOrderDate: 1,
      },
    },
    { $sort: { orderCount: -1, totalSpent: -1 } },
    { $limit: limit },
  ]);
}

// ── Tool Declarations for Gemini ──────────────────────────────────────────────

const tools = [
  {
    name: "get_dashboard_totals",
    description:
      "Returns today's, this week's, and this month's billing count and total revenue.",
  },
  {
    name: "get_branch_performance",
    description:
      "Returns total revenue and billing count for every branch, sorted by revenue descending.",
  },
  {
    name: "get_sales_person_performance",
    description:
      "Returns total revenue and billing count for every salesperson, sorted by revenue descending.",
  },
  {
    name: "get_product_category_breakdown",
    description:
      "Returns number of units sold and revenue by product category (e.g. Laptop, Desktop, AIO).",
  },
  {
    name: "get_top_products",
    description:
      "Returns specific top selling product items or models by units sold and revenue. Optional category filter (e.g. desktops, laptops, aios, accessories).",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional product category to filter by (e.g. desktops, laptops, aios, accessories)",
        },
      },
    },
  },
  {
    name: "get_top_customers",
    description:
      "Returns top repeat customers ranked by order/invoice count and total amount spent.",
  },
  {
    name: "get_monthly_trends",
    description:
      "Returns monthly billing count and revenue for a given year.",
    parameters: {
      type: "object",
      properties: {
        year: {
          type: "number",
          description: "The calendar year to fetch data for (e.g. 2026). Defaults to the current year.",
        },
      },
    },
  },
  {
    name: "get_payment_mode_breakdown",
    description:
      "Returns billing count and revenue broken down by payment mode (Cash, UPI, Machine, etc.).",
  },
  {
    name: "get_all_targets",
    description:
      "Returns all sales targets including their type, target value, current progress, status, and assigned salesperson.",
  },
];


// ── Tool Dispatcher ───────────────────────────────────────────────────────────

async function dispatchTool(name, args) {
  switch (name) {
    case "get_dashboard_totals":         return tool_getDashboardTotals();
    case "get_branch_performance":       return tool_getBranchPerformance();
    case "get_sales_person_performance": return tool_getSalesPersonPerformance();
    case "get_product_category_breakdown": return tool_getProductCategoryBreakdown();
    case "get_top_products":             return tool_getTopProducts(args ?? {});
    case "get_top_customers":            return tool_getTopCustomers(args ?? {});
    case "get_monthly_trends":           return tool_getMonthlyTrends(args ?? {});
    case "get_payment_mode_breakdown":   return tool_getPaymentModeBreakdown();
    case "get_all_targets":              return tool_getAllTargets();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are WareFlow AI, an intelligent business analytics assistant for a retail billing and inventory management system.

CRITICAL DIRECTIVES:
1. YOU ARE DIRECTLY CONNECTED TO THE LIVE MONGODB DATABASE via tools.
2. Whenever a user asks ANY question about branch performance, revenue, sales, salespersons, targets, product categories, top products/models, repeat customers, or trends, YOU MUST IMMEDIATELY CALL THE APPROPRIATE TOOL to fetch live data.
3. NEVER claim you lack database access.
4. NEVER tell the user to paste SQL queries, tables, or data exports.
5. NEVER give generic advice when asked for store metrics — call the tools first, then present the real database numbers!

TABLE FORMATTING RULES (STRICT):
- ALWAYS format data in clean GitHub Flavored Markdown (GFM) tables with header divider lines (e.g., | Column 1 | Column 2 |).
- ALWAYS put a blank line BEFORE starting a table and a blank line AFTER finishing a table.
- Every single table row MUST be on its own line. Never concatenate rows onto a single line.
- Format monetary values in Indian Rupees (₹) with proper Indian numbering system (e.g., ₹57,10,527).
- Proactively highlight key insights after presenting the data table.
- Today's date is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

// ── Main Controller ───────────────────────────────────────────────────────────

export const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Message too long (max 1000 characters)." });
    }

    // Build conversation contents for the API
    const recentHistory = history.slice(-10);

    const contents = [
      ...recentHistory.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.content }],
      })),
      { role: "user", parts: [{ text: message.trim() }] },
    ];

    const ai = getAI();

    // First call: allow Gemini to request tools
    let response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: tools }],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      },
    });

    // Agentic loop: resolve all tool calls before final response
    let iterations = 0;
    while (iterations < 5) {
      iterations++;
      const candidate = response.candidates?.[0];
      if (!candidate) break;

      const functionCalls = candidate.content?.parts?.filter((p) => p.functionCall);
      if (!functionCalls || functionCalls.length === 0) break;

      // Execute all requested tools in parallel
      const toolResults = await Promise.all(
        functionCalls.map(async (part) => {
          const { name, args } = part.functionCall;
          try {
            const result = await dispatchTool(name, args);
            return { name, result };
          } catch (err) {
            return { name, result: { error: err.message } };
          }
        })
      );

      // Build the tool response turn
      const functionResponseParts = toolResults.map(({ name, result }) => ({
        functionResponse: { name, response: { output: result } },
      }));

      // Append model's tool request and our tool responses to the conversation
      contents.push({ role: "model", parts: candidate.content.parts });
      contents.push({ role: "user", parts: functionResponseParts });

      // Continue the conversation
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: tools }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        },
      });
    }

    // Extract final text response
    const finalText = response.candidates?.[0]?.content?.parts
      ?.filter((p) => p.text)
      ?.map((p) => p.text)
      ?.join("") ?? "I couldn't generate a response. Please try again.";

    return res.json({ success: true, reply: finalText });
  } catch (error) {
    console.error("AI chat error:", error);
    return res.status(500).json({
      success: false,
      message: "AI assistant is temporarily unavailable. Please try again later.",
      _debug: error?.message ?? String(error),
    });
  }
};

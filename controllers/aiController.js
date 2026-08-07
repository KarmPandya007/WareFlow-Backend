import { GoogleGenAI } from "@google/genai";
import Billing from "../models/billing.js";
import User from "../models/User.js";
import Target from "../models/target.js";
import Product from "../models/product.js";
import Branch from "../models/branch.js";
import InventoryTransfer from "../models/inventoryTransfer.js";
import Godown from "../models/godown.js";
import Ledger from "../models/ledger.js";
import AdvanceBooking from "../models/advanceBooking.js";
import QRUpload from "../models/QRUpload.js";
import Notification from "../models/notification.js";
import AIConversation from "../models/aiConversation.js";

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

async function tool_getBranchSalesPersonPerformance() {
  return Billing.aggregate([
    {
      $group: {
        _id: { branch: "$branch", salesPerson: "$salesPerson" },
        totalAmount: { $sum: "$totalAmount" },
        count: { $sum: 1 },
        averageBillingAmount: { $avg: "$totalAmount" },
        lastBillingDate: { $max: "$date" },
      },
    },
    { $lookup: { from: "branches", localField: "_id.branch", foreignField: "_id", as: "branch" } },
    { $lookup: { from: "users", localField: "_id.salesPerson", foreignField: "_id", as: "salesPerson" } },
    { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
    { $unwind: { path: "$salesPerson", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        branchName: { $ifNull: ["$branch.name", "Unknown Branch"] },
        branchCode: { $ifNull: ["$branch.code", "N/A"] },
        salesPersonName: {
          $let: {
            vars: {
              fullName: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$salesPerson.firstName", ""] },
                      " ",
                      { $ifNull: ["$salesPerson.lastName", ""] },
                    ],
                  },
                },
              },
            },
            in: { $cond: [{ $eq: ["$$fullName", ""] }, "Unknown Salesperson", "$$fullName"] },
          },
        },
        totalAmount: 1,
        count: 1,
        averageBillingAmount: { $round: ["$averageBillingAmount", 2] },
        lastBillingDate: 1,
      },
    },
    { $sort: { branchName: 1, totalAmount: -1 } },
  ]);
}

async function tool_getSalesPersonBranchAssignments() {
  const users = await User.find({ role: "sales_person" })
    .populate("branches", "name code location status")
    .select("firstName lastName employmentId status branches")
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  return users.map((user) => ({
    salesPersonName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    employmentId: user.employmentId ?? "N/A",
    salesPersonStatus: user.status,
    branches: (user.branches ?? []).filter(Boolean).map((branch) => ({
      branchName: branch.name,
      branchCode: branch.code ?? "N/A",
      location: branch.location ?? "N/A",
      branchStatus: branch.status,
    })),
  }));
}

const clampRecordLimit = (limit) => Math.min(Math.max(Number(limit) || 50, 1), 100);
const clampRecordOffset = (offset) => Math.min(Math.max(Number(offset) || 0, 0), 10000);

async function tool_getInventoryTransfers({ limit = 100, offset = 0 } = {}) {
  const safeLimit = clampRecordLimit(limit);
  const safeOffset = clampRecordOffset(offset);

  const [totalTransfers, quantitySummary, transfers] = await Promise.all([
    InventoryTransfer.countDocuments(),
    InventoryTransfer.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalQuantityMoved: { $sum: "$items.quantity" },
          totalLineItems: { $sum: 1 },
        },
      },
    ]),
    InventoryTransfer.find()
      .populate("items.product", "name model serialNumber category branch status")
      .populate("sourceGodown", "name address")
      .populate("destinationGodown", "name address")
      .populate("createdBy", "firstName lastName employmentId role")
      .sort({ date: -1, createdAt: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean(),
  ]);

  return {
    totalTransfers,
    totalQuantityMoved: quantitySummary[0]?.totalQuantityMoved ?? 0,
    totalLineItems: quantitySummary[0]?.totalLineItems ?? 0,
    offset: safeOffset,
    returned: transfers.length,
    transfers,
  };
}

async function tool_getDatabaseOverview() {
  const collections = {
    billings: Billing,
    products: Product,
    branches: Branch,
    salespeople: User,
    targets: Target,
    inventory_transfers: InventoryTransfer,
    godowns: Godown,
    ledgers: Ledger,
    advance_bookings: AdvanceBooking,
    qr_uploads: QRUpload,
    notifications: Notification,
  };

  const counts = Object.fromEntries(await Promise.all(
    Object.entries(collections).map(async ([name, Model]) => [name, await Model.countDocuments()])
  ));

  return {
    counts,
    relationships: [
      "billings.branch -> branches",
      "billings.salesPerson -> users",
      "billings.products[] -> products",
      "targets.user and targets.assignedBy -> users",
      "inventory_transfers.items[].product -> products",
      "inventory_transfers.sourceGodown and destinationGodown -> godowns",
      "inventory_transfers.createdBy -> users",
      "advance_bookings.branch -> branches",
      "advance_bookings.salesPerson/createdBy/updatedBy -> users",
      "advance_bookings.products[] -> products",
      "notifications.billing -> billings",
      "users.branches[] -> branches",
    ],
    excludedSensitiveCollections: ["configs (contains service credentials)"],
  };
}

async function tool_getBusinessRecords({ dataset, limit = 50, offset = 0 } = {}) {
  const safeLimit = clampRecordLimit(limit);
  const safeOffset = clampRecordOffset(offset);
  let query;
  let Model;

  switch (dataset) {
    case "billings":
      Model = Billing;
      query = Billing.find()
        .select("-paymentMode.machineIdProofNumber -paymentMode.idProofNumber")
        .populate("branch", "name code location status")
        .populate("salesPerson", "firstName lastName email employmentId status branches")
        .populate("products", "name model serialNumber category price branch status");
      break;
    case "products":
      Model = Product;
      query = Product.find();
      break;
    case "branches":
      Model = Branch;
      query = Branch.find();
      break;
    case "salespeople":
      Model = User;
      query = User.find({ role: "sales_person" })
        .select("-pin")
        .populate("branches", "name code location status");
      break;
    case "targets":
      Model = Target;
      query = Target.find()
        .populate("user", "firstName lastName email employmentId status branches")
        .populate("assignedBy", "firstName lastName role");
      break;
    case "inventory_transfers":
      return tool_getInventoryTransfers({ limit: safeLimit, offset: safeOffset });
    case "godowns":
      Model = Godown;
      query = Godown.find();
      break;
    case "ledgers":
      Model = Ledger;
      query = Ledger.find();
      break;
    case "advance_bookings":
      Model = AdvanceBooking;
      query = AdvanceBooking.find()
        .select("-paymentMode.machineIdProofNumber -paymentMode.idProofNumber")
        .populate("branch", "name code location status")
        .populate([
          { path: "salesPerson", select: "firstName lastName employmentId role status" },
          { path: "createdBy", select: "firstName lastName employmentId role status" },
          { path: "updatedBy", select: "firstName lastName employmentId role status" },
        ])
        .populate("products", "name model serialNumber category price branch status");
      break;
    case "qr_uploads":
      Model = QRUpload;
      query = QRUpload.find();
      break;
    case "notifications":
      Model = Notification;
      query = Notification.find().populate("billing", "customerName totalAmount date branch salesPerson");
      break;
    default:
      throw new Error(`Unsupported business dataset: ${dataset}`);
  }

  const [totalRecords, records] = await Promise.all([
    Model.countDocuments(dataset === "salespeople" ? { role: "sales_person" } : {}),
    query.sort({ createdAt: -1 }).skip(safeOffset).limit(safeLimit).lean(),
  ]);

  return { dataset, totalRecords, offset: safeOffset, returned: records.length, records };
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
    name: "get_branch_salesperson_performance",
    description:
      "Returns a direct branch-by-salesperson performance mapping calculated from billing records, including each salesperson's invoice count, revenue, average invoice value, and latest billing date within each branch. Use this when the user asks who sold or performed in each branch, or requests branch and salesperson performance in one table.",
  },
  {
    name: "get_salesperson_branch_assignments",
    description:
      "Returns the configured branch assignments for every salesperson, including employee ID and status. Use this when the user asks which salesperson is assigned to which branch. This is assignment data, not inferred sales activity.",
  },
  {
    name: "get_inventory_transfers",
    description:
      "Returns complete reference-aware inventory transfer data: source and destination godowns, products, quantities, batch numbers, creator, dates, and overall transfer/quantity totals. Use this for every question about stock movements, warehouse transfers, or inventory transfers.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of transfers to return, from 1 to 100. Defaults to 100." },
        offset: { type: "number", description: "Number of transfers to skip for pagination. Defaults to 0." },
      },
    },
  },
  {
    name: "get_database_overview",
    description:
      "Returns all AI-accessible business datasets, their document counts, and the reference relationships between collections. Use when the admin asks what data exists, asks for everything in the database, or needs to discover available records and connections.",
  },
  {
    name: "get_business_records",
    description:
      "Returns records from any allowed business dataset with MongoDB references populated into readable related data. Use this for detailed requests about billings, products, branches, salespeople, targets, inventory transfers, godowns, ledgers, advance bookings, QR uploads, or notifications. Secrets and credential fields are excluded.",
    parameters: {
      type: "object",
      required: ["dataset"],
      properties: {
        dataset: {
          type: "string",
          enum: ["billings", "products", "branches", "salespeople", "targets", "inventory_transfers", "godowns", "ledgers", "advance_bookings", "qr_uploads", "notifications"],
          description: "Business dataset to retrieve.",
        },
        limit: { type: "number", description: "Number of records to return, from 1 to 100. Defaults to 50." },
        offset: { type: "number", description: "Number of records to skip for pagination. Defaults to 0." },
      },
    },
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
    case "get_branch_salesperson_performance": return tool_getBranchSalesPersonPerformance();
    case "get_salesperson_branch_assignments": return tool_getSalesPersonBranchAssignments();
    case "get_inventory_transfers":     return tool_getInventoryTransfers(args ?? {});
    case "get_database_overview":       return tool_getDatabaseOverview();
    case "get_business_records":        return tool_getBusinessRecords(args ?? {});
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
6. When a user asks which salesperson is assigned to which branch, call get_salesperson_branch_assignments. When they ask for salesperson performance within branches, call get_branch_salesperson_performance. Do not claim these are separate or unmappable datasets.
7. You can inspect every non-secret business dataset with get_database_overview and get_business_records. For inventory transfer questions, always call get_inventory_transfers. Never claim that inventory transfers, warehouse movements, advance bookings, ledgers, products, godowns, notifications, QR uploads, or their references are unavailable.
8. For broad requests such as "everything in the database", first call get_database_overview, then call get_business_records for the relevant datasets. Respect pagination metadata and clearly say when additional records exist.
9. Configuration secrets, authentication PIN hashes, and full Aadhaar/PAN identity-proof values are intentionally unavailable. Never request, infer, or expose credentials or secrets.

TABLE FORMATTING RULES (STRICT):
- ALWAYS format data in clean GitHub Flavored Markdown (GFM) tables with header divider lines (e.g., | Column 1 | Column 2 |).
- ALWAYS put a blank line BEFORE starting a table and a blank line AFTER finishing a table.
- Every single table row MUST be on its own line. Never concatenate rows onto a single line.
- The header row MUST start and end with | and the very next line MUST be a divider such as |---|---|. Never output columns separated only by spaces.
- Keep table cells concise. Use one physical line per row and never insert line breaks inside a cell.
- For inventory transfers, use these columns unless the user requests others: Date, Source, Destination, Product, Qty, Batch, Created By.
- Format dates as DD MMM YYYY (for example, 26 Feb 2026) so dates do not wrap awkwardly.
- Format monetary values in Indian Rupees (₹) with proper Indian numbering system (e.g., ₹57,10,527).
- Proactively highlight key insights after presenting the data table.
- Today's date is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

// ── Main Controller ───────────────────────────────────────────────────────────

const conversationOwnerQuery = (req, id) => ({ _id: id, user: req.user._id });

export const listConversations = async (req, res) => {
  try {
    const conversations = await AIConversation.find({ user: req.user._id })
      .select("title updatedAt createdAt messages")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      conversations: conversations.map(({ messages, ...conversation }) => ({
        ...conversation,
        messageCount: messages.length,
        preview: messages.at(-1)?.content?.slice(0, 120) ?? "",
      })),
    });
  } catch (error) {
    console.error("List AI conversations error:", error);
    return res.status(500).json({ success: false, message: "Could not load conversations." });
  }
};

export const getConversation = async (req, res) => {
  try {
    const conversation = await AIConversation.findOne(conversationOwnerQuery(req, req.params.id)).lean();
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }
    return res.json({ success: true, conversation });
  } catch (error) {
    if (error?.name === "CastError") {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }
    console.error("Get AI conversation error:", error);
    return res.status(500).json({ success: false, message: "Could not load the conversation." });
  }
};

export const renameConversation = async (req, res) => {
  try {
    const title = typeof req.body.title === "string" ? req.body.title.trim().slice(0, 100) : "";
    if (!title) return res.status(400).json({ success: false, message: "Title is required." });

    const conversation = await AIConversation.findOneAndUpdate(
      conversationOwnerQuery(req, req.params.id),
      { title },
      { new: true, runValidators: true }
    ).select("title updatedAt createdAt");
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    return res.json({ success: true, conversation });
  } catch (error) {
    if (error?.name === "CastError") return res.status(404).json({ success: false, message: "Conversation not found." });
    console.error("Rename AI conversation error:", error);
    return res.status(500).json({ success: false, message: "Could not rename the conversation." });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const conversation = await AIConversation.findOneAndDelete(conversationOwnerQuery(req, req.params.id));
    if (!conversation) return res.status(404).json({ success: false, message: "Conversation not found." });
    return res.json({ success: true });
  } catch (error) {
    if (error?.name === "CastError") return res.status(404).json({ success: false, message: "Conversation not found." });
    console.error("Delete AI conversation error:", error);
    return res.status(500).json({ success: false, message: "Could not delete the conversation." });
  }
};

export const chat = async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ success: false, message: "Message too long (max 1000 characters)." });
    }

    let conversation;
    if (conversationId) {
      conversation = await AIConversation.findOne(conversationOwnerQuery(req, conversationId));
      if (!conversation) {
        return res.status(404).json({ success: false, message: "Conversation not found." });
      }
    } else {
      conversation = new AIConversation({ user: req.user._id, title: message.trim().slice(0, 60) });
    }

    // The database is the source of truth; never trust client-supplied history.
    const recentHistory = conversation.messages.slice(-10);

    const contents = [
      ...recentHistory.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
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

    conversation.messages.push(
      { role: "user", content: message.trim() },
      { role: "assistant", content: finalText }
    );
    await conversation.save();

    return res.json({
      success: true,
      reply: finalText,
      conversationId: conversation._id,
      conversation: {
        _id: conversation._id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return res.status(500).json({
      success: false,
      message: "AI assistant is temporarily unavailable. Please try again later.",
      _debug: error?.message ?? String(error),
    });
  }
};

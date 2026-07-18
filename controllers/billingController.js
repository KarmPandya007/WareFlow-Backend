import Billing from "../models/billing.js";
import Product from "../models/product.js";
import Branch from "../models/branch.js";
import Target from "../models/target.js";
import { sendWhatsAppAdminText } from "../services/whatsappCloudService.js";
import QRUpload from "../models/QRUpload.js";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
// XML/Tally integration removed from project

// Build admin WhatsApp message
const buildAdminBillingMessage = (billing) => {
  const products = billing.products?.length
    ? billing.products
        .map(
          (p, i) => `
${i + 1})
NAME: ${p.name || "N/A"}
MODEL: ${p.model || "N/A"}
SR.NO: ${p.serialNumber || "PENDING"}
CHECK: ${p.checkCode || "Manual Check"}
PRICE: ₹${p.price || 0}`
        )
        .join("\n")
    : "\n(No products added)";

  const attachments = billing.attachments || {};
  const attachmentsList = [];

  if (attachments.customerID) attachmentsList.push("Customer ID");
  if (attachments.paymentSlip) attachmentsList.push("Payment Slip");
  if (attachments.inventoryPics?.length)
    attachmentsList.push(`Inventory Pic ${attachments.inventoryPics.length}`);
  if (attachments.googleReview) attachmentsList.push("Google Review Pic");

  const attachmentOutput = attachmentsList.length
    ? attachmentsList.map((a, idx) => `${idx + 1}. ${a}`).join("\n")
    : "(No attachments uploaded)";

  return `ST Billing Detail

Company Name :- ${billing.companyName || "N/A"}
Branch:- ${billing.branch?.name || "N/A"}
Sales in : ${billing.salesType || "Retail"}
Sales Person Name :- ${
    billing.salesPerson
      ? `${billing.salesPerson.firstName || ""} ${billing.salesPerson.lastName || ""}`
      : "N/A"
  }

DATE : ${new Date(billing.date).toString()}

Billing Name   : ${billing.customerName || "N/A"}
Address        : ${billing.address || "N/A"}
Pin Code       : ${billing.pinCode || "N/A"}
Con. Person    : ${billing.contactPerson || billing.customerName || "N/A"}
Mobile         : ${billing.mobile || "N/A"}
Phone No.      : ${billing.phone || "N/A"}
Email ID       : ${billing.email || "N/A"}
GST No         : ${billing.gstNumber || "N/A"}

Payment Mode  : ${billing.paymentMode || "N/A"}

Billing Price : ₹${billing.totalAmount || 0}

*
Product Details:
${products}

Attachments
${attachmentOutput}`;
};

// CREATE BILLING
export const createBilling = async (req, res) => {
  try {
    const user = req.user;

    if (!user || !user._id) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required. Please login again." 
      });
    }

    if (!req.body.customerName) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required"
      });
    }

    if (!req.body.totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Total amount is required"
      });
    }

    const getFileUrl = (file) => {
      if (!file) return "";
      return file.secure_url || file.url || file.path || "";
    };

    const attachments = {
      customerID: getFileUrl(req.files?.customerID?.[0]) || "",
      paymentSlip: getFileUrl(req.files?.paymentSlip?.[0]) || "",
      inventoryPics:
        req.files?.inventoryPics?.map((file) => getFileUrl(file)) || [],
      googleReview: getFileUrl(req.files?.googleReview?.[0]) || "",
    };

    const { sessionId } = req.body;

    if (sessionId) {
      try {
        const qrUploads = await QRUpload.find({ sessionId, processed: false });

        for (const upload of qrUploads) {
          const fieldType = upload.fieldType || "General Attachment";

          switch (fieldType) {
            case "Customer ID":
              if (!attachments.customerID)
                attachments.customerID = upload.fileUrl;
              break;
            case "Payment Slip":
              if (!attachments.paymentSlip)
                attachments.paymentSlip = upload.fileUrl;
              break;
            case "Google Review":
              if (!attachments.googleReview)
                attachments.googleReview = upload.fileUrl;
              break;
            default:
              attachments.inventoryPics.push(upload.fileUrl);
              break;
          }

          upload.processed = true;
          await upload.save();
        }
        } catch (err) {
        // Don't return error here, continue with billing creation
      }
    }

    // Resolve branch from multiple possible fields sent by frontend
    const branchCandidates = [req.body.branchId, req.body.branch, req.body.branchName, req.body.branchObj];
    let branchId = null;

    // Helper to attempt resolution from a raw input
    const tryResolve = async (raw) => {
      if (!raw && raw !== 0) return null;

      // If it's an object already (e.g., frontend sent JSON string that was parsed), accept _id or id
      if (typeof raw === 'object') {
        if (raw._id && /^[0-9a-fA-F]{24}$/.test(String(raw._id))) return raw._id;
        if (raw.id && /^[0-9a-fA-F]{24}$/.test(String(raw.id))) return raw.id;
      }

      // If it's a string that looks like JSON, try parse
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object') {
              if (parsed._id && /^[0-9a-fA-F]{24}$/.test(String(parsed._id))) return parsed._id;
              if (parsed.id && /^[0-9a-fA-F]{24}$/.test(String(parsed.id))) return parsed.id;
            }
          } catch (e) {
            // ignore
          }
        }
      }

      // Now try as string id
      if (typeof raw === 'string' && /^[0-9a-fA-F]{24}$/.test(raw)) {
        const bdoc = await Branch.findById(raw).select('_id').lean();
        if (bdoc) return bdoc._id;
      }

      // Try as code
      if (typeof raw === 'string') {
        const bdoc = await Branch.findOne({ code: raw }).select('_id').lean();
        if (bdoc) return bdoc._id;

        // Try exact name (case-insensitive)
        let bdocName = await Branch.findOne({ name: new RegExp(`^${escapeRegExp(String(raw))}$`, 'i') }).select('_id').lean();
        if (bdocName) return bdocName._id;

        // Try partial name
        bdocName = await Branch.findOne({ name: new RegExp(escapeRegExp(String(raw)), 'i') }).select('_id').lean();
        if (bdocName) return bdocName._id;
      }

      return null;
    };

    for (const candidate of branchCandidates) {
      if (!candidate && candidate !== 0) continue;
      const resolved = await tryResolve(candidate);
      if (resolved) {
        branchId = resolved;
        break;
      }
    }

    if (!branchId && user.branch) branchId = user.branch;

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch is required for billing. Provide branch id, code or name, or ensure the authenticated user has a branch.' });
    }

    // Parse paymentMode from JSON string if needed (FormData sends it as string)
    let paymentMode = req.body.paymentMode;
    if (paymentMode && typeof paymentMode === 'string') {
      try {
        paymentMode = JSON.parse(paymentMode);
      } catch (e) {
        const modes = paymentMode.split(',').map(m => m.trim()).filter(m => m);
        paymentMode = modes.map(m => ({ mode: m, amount: 0 }));
      }
    }

    // Parse customFields from JSON string if needed
    let customFields = [];
    if (req.body.customFields) {
      try {
        customFields = typeof req.body.customFields === 'string'
          ? JSON.parse(req.body.customFields)
          : req.body.customFields;
      } catch (e) { customFields = []; }
    }

    const billingData = {
      companyName: req.body.companyName || '',
      salesType: req.body.salesType || 'Retail',
      customerName: req.body.customerName,
      address: req.body.address || '',
      pinCode: req.body.pinCode || '',
      contactPerson: req.body.contactPerson || '',
      mobile: req.body.mobile || '',
      phone: req.body.phone || '',
      email: req.body.email || '',
      gstNumber: req.body.gstNumber || '',
      referralSource: req.body.referralSource || undefined,
      referralSourceOther: req.body.referralSourceOther || '',
      totalAmount: Number(req.body.totalAmount),
      paymentMode,
      customFields,
      salesPerson: user._id,
      branch: branchId,
      date: req.body.date || new Date(),
      attachments,
    };

    // Handle paymentMode: already parsed above, but keep cheque/bank validation
    if (billingData.paymentMode && typeof billingData.paymentMode === 'string') {
      try {
        billingData.paymentMode = JSON.parse(billingData.paymentMode);
      } catch (e) {
        // If not JSON, treat as legacy format and convert to new format
        const modes = billingData.paymentMode.split(',').map(mode => mode.trim()).filter(mode => mode);
        billingData.paymentMode = modes.map(mode => ({ mode, amount: 0 }));
      }
    }

    // If paymentMode includes Cheque (case-insensitive), require cheque number
    const paymentModes = Array.isArray(billingData.paymentMode) 
      ? billingData.paymentMode.map(pm => typeof pm === 'object' ? pm.mode : pm)
      : (billingData.paymentMode ? [billingData.paymentMode] : []);
    const hasCheque = paymentModes.some(m => typeof m === 'string' && /^cheque$/i.test(m));
    const hasBank = paymentModes.some(m => typeof m === 'string' && /^bank$/i.test(m));
    if (hasCheque || hasBank) {
      const chequeNo = req.body.chequeNumber || req.body.chequeNo || billingData.chequeNumber || req.body.cheque_number;
      if (hasCheque && (!chequeNo || String(chequeNo).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Cheque number is required when payment mode includes Cheque' });
      }
      if (chequeNo) billingData.chequeNumber = String(chequeNo).trim();
    }

    // Validate required fields
    if (!req.body.customerName) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required"
      });
    }

    if (!req.body.totalAmount || req.body.totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid total amount is required"
      });
    }

    // Validate and process products
    let productIds = [];
    let productsToProcess = [];
    
    if (req.body.products && typeof req.body.products === 'string') {
      try {
        const parsedProducts = JSON.parse(req.body.products);
        if (Array.isArray(parsedProducts) && parsedProducts.length > 0) {
          productsToProcess = parsedProducts;
        }
      } catch (e) {}
    }
    
    if (productsToProcess.length === 0 && req.body.productDetails) {
      try {
        const parsedProductDetails = JSON.parse(req.body.productDetails);
        if (Array.isArray(parsedProductDetails) && parsedProductDetails.length > 0) {
          productsToProcess = parsedProductDetails.map(p => p._id).filter(id => id);
        }
      } catch (e) {}
    }
    
    if (productsToProcess.length === 0 && Array.isArray(req.body.products)) {
      productsToProcess = req.body.products;
    }
    
    if (productsToProcess && productsToProcess.length > 0) {
      for (let productData of productsToProcess) {
        if (typeof productData === 'string') {
          if (productData.match(/^[0-9a-fA-F]{24}$/)) {
            try {
              const existingProduct = await Product.findById(productData);
              if (!existingProduct) continue;
              productIds.push(productData);
            } catch (error) {
              continue;
            }
          } else {
            return res.status(400).json({
              success: false,
              message: 'Product name and category are required for new products. Please send a product object with both fields.'
            });
          }
        }
        else if (typeof productData === 'object' && productData.name && productData.category) {
          let existingProduct = await Product.findOne({ name: productData.name, category: productData.category });
          if (existingProduct) {
            productIds.push(existingProduct._id);
          } else {
            try {
              const product = await Product.create({
                name: productData.name,
                category: productData.category,
                model: productData.model || '',
                serialNumber: productData.serialNumber || '',
                checkCode: productData.checkCode || '',
                price: productData.price || 0,
                description: productData.description || ''
              });
              productIds.push(product._id);
            } catch (productError) {
              continue;
            }
          }
        }
        else if (typeof productData === 'object' && productData.name && productData.model && productData.price) {
          try {
            const product = await Product.create({
              name: productData.name,
              model: productData.model,
              serialNumber: productData.serialNumber || "",
              checkCode: productData.checkCode || "",
              price: productData.price,
              description: productData.description || ""
            });
            productIds.push(product._id);
          } catch (productError) {
            return res.status(400).json({
              success: false,
              message: `Failed to create product: ${productError.message}`
            });
          }
        }
        else {
          continue;
        }
      }
    } else {
      productIds = [];
    }

    // Update billing data with product IDs
    billingData.products = productIds;

    const newBilling = await Billing.create(billingData);

    const populatedBilling = await Billing.findById(newBilling._id)
      .populate("branch", "name code location")
      .populate("salesPerson", "firstName lastName email")
      .populate("products", "name model serialNumber");

    // Tally/XML integration removed — not sending invoice to Tally from server

    // WhatsApp notification (async, non-blocking)
    (async () => {
      try {
        const adminMessage = buildAdminBillingMessage(populatedBilling);
        await sendWhatsAppAdminText("916204504480", adminMessage);
      } catch (err) {
        console.log(`⚠️ WhatsApp notification skipped (token issue)`);
      }
    })();

    // UPDATE TARGET PROGRESS (async, non-blocking)
    setImmediate(async () => {
      try {
        const activeTargets = await Target.find({
          user: user._id,
          status: "active",
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        });

        for (const target of activeTargets) {
          if (target.targetType === "billing_count") {
            const count = await Billing.countDocuments({
              salesPerson: user._id,
              createdAt: { $gte: target.startDate, $lte: target.endDate },
            });
            target.currentValue = count;
          } else if (target.targetType === "billing_amount") {
            const result = await Billing.aggregate([
              {
                $match: {
                  salesPerson: user._id,
                  createdAt: { $gte: target.startDate, $lte: target.endDate },
                },
              },
              { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]);
            target.currentValue = result.length > 0 ? result[0].total : 0;
          } else if (target.targetType === "product_based") {
            // Update each product category target
            for (let i = 0; i < target.productTargets.length; i++) {
              const productTarget = target.productTargets[i];
              const count = await Billing.aggregate([
                {
                  $match: {
                    salesPerson: user._id,
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
            
            // Check if all product targets are met
            const allTargetsMet = target.productTargets.every(
              (pt) => pt.currentValue >= pt.targetValue
            );
            if (allTargetsMet) {
              target.status = "completed";
            }
          }

          // Update status based on target completion
          if (target.targetType !== "product_based" && target.currentValue >= target.targetValue) {
            target.status = "completed";
          }

          await target.save();
        }
      } catch (err) {}
    });

    console.log(`✅ Billing created: ${populatedBilling.customerName} | Products: ${populatedBilling.products.length} | Payment: ${JSON.stringify(populatedBilling.paymentMode)}`);
    console.log(`⚠️ WhatsApp notification skipped (token issue)`);

    res.status(201).json({
      success: true,
      message: "Invoice created successfully!",
      billing: populatedBilling,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed",
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Duplicate data found. Please check your input."
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid ${error.path}: ${error.value}`
      });
    }

    console.error("Create billing error:", error.name, error.message);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create invoice. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// EXPORT BILLINGS
export const exportBillings = async (req, res) => {
  try {
    const { branch, fromDate, toDate, format = "xlsx" } = req.query;

    const filter = {};
    if (branch) filter.branch = branch;
    if (fromDate && toDate) {
      filter.date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    const billings = await Billing.find(filter)
      .populate("branch", "name code")
      .populate("salesPerson", "firstName lastName email")
      .populate("products");

    if (!billings || billings.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "No billings found for given filters" });

    const rows = billings.map((b) => ({
      InvoiceID: b._id.toString(),
      Date: new Date(b.date).toLocaleDateString(),
      Company: b.companyName || "",
      Customer: b.customerName || "",
      Mobile: b.mobile || "",
      Branch: b.branch?.name || "",
      SalesPerson: `${b.salesPerson?.firstName || ""} ${
        b.salesPerson?.lastName || ""
      }`,
      PaymentMode: b.paymentMode || "",
      TotalAmount: b.totalAmount || "",
      Products: b.products.map((p) => `${p.name} (${p.model})`).join(", "),
    }));

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Billing Records");

      worksheet.columns = Object.keys(rows[0]).map((key) => ({
        header: key,
        key,
        width: 20,
      }));

      rows.forEach((row) => worksheet.addRow(row));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Billing_Export_${Date.now()}.xlsx"`
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === "csv") {
      const parser = new Parser({ fields: Object.keys(rows[0]) });
      const csv = parser.parse(rows);

      res.header("Content-Type", "text/csv");
      res.attachment(`Billing_Export_${Date.now()}.csv`);
      return res.send(csv);
    }

    return res.status(400).json({ success: false, message: "Invalid format" });
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL BILLINGS
export const getAllBillings = async (req, res) => {
  try {
    const filter = req.user.role === "sales_person" ? { salesPerson: req.user._id } : {};

    // Fetch billings with salesPerson and products populated, but keep the raw `branch` value
    let billings = await Billing.find(filter)
      .populate("salesPerson", "firstName lastName email")
      .populate({
        path: "products",
        model: "Product",
        select: "model serialNumber checkCode category",
      })
      .populate("branch")
      .lean();

    // For any billing where branch is not an object (i.e. not populated), try to resolve it:
    // - If branch looks like an ObjectId, try Branch.findById
    // - Otherwise try Branch.findOne by `code`, then by `name` (case-insensitive)
    for (let i = 0; i < billings.length; i++) {
      const b = billings[i];

      // If already populated (object with name), skip
      if (b.branch && typeof b.branch === "object" && (b.branch.name || b.branch.code)) {
        continue;
      }

      const rawBranch = b.branch;
      if (!rawBranch) {
        b.branch = null;
        continue;
      }

      let branchDoc = null;

      // Try as ObjectId string
      if (typeof rawBranch === "string" && /^[0-9a-fA-F]{24}$/.test(rawBranch)) {
        branchDoc = await Branch.findById(rawBranch).select("name code location").lean();
      }

      // Try as code
      if (!branchDoc) {
        branchDoc = await Branch.findOne({ code: rawBranch }).select("name code location").lean();
      }

      // Try as exact name (case-insensitive), then fallback to partial match
      if (!branchDoc) {
        branchDoc = await Branch.findOne({ name: new RegExp(`^${escapeRegExp(String(rawBranch))}$`, "i") })
          .select("name code location")
          .lean();
      }

      if (!branchDoc) {
        branchDoc = await Branch.findOne({ name: new RegExp(escapeRegExp(String(rawBranch)), "i") })
          .select("name code location")
          .lean();
      }

      b.branch = branchDoc || null;
    }

    res.status(200).json({
      success: true,
      count: billings.length,
      billings,
    });
  } catch (error) {
    console.error("Get billings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to escape user-provided strings for RegExp
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET BILLING BY ID
export const getBillingById = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id)
      .populate("branch", "name code location")
      .populate("salesPerson", "firstName lastName email")
      .populate("products");

    if (!billing) {
      return res.status(404).json({ success: false, message: "Billing not found" });
    }

    if (
      req.user.role === "sales_person" &&
      billing.salesPerson._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({ success: true, billing });
  } catch (error) {
    console.error("Get billing error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE BILLING
export const updateBilling = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ success: false, message: "Billing not found" });
    }

    const isOwner = billing.salesPerson.toString() === req.user._id.toString();

    if (req.user.role === "sales_person" && !isOwner) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const sixHours = 6 * 60 * 60 * 1000;
    const timeElapsed = Date.now() - new Date(billing.createdAt).getTime();

    if (req.user.role === "sales_person" && timeElapsed > sixHours) {
      return res.status(403).json({
        success: false,
        message: "Edit window expired (6 hours). Contact admin.",
      });
    }

    // If branch is provided in the update, attempt to resolve it like createBilling
    const updateData = { ...req.body };
    if (req.body.branch || req.body.branchId || req.body.branchName) {
      const candidate = req.body.branchId || req.body.branch || req.body.branchName;
      let resolvedBranch = null;
      // try parse if JSON
      try {
        if (typeof candidate === 'string' && candidate.trim().startsWith('{')) {
          const parsed = JSON.parse(candidate);
          if (parsed && (parsed._id || parsed.id)) resolvedBranch = parsed._id || parsed.id;
        }
      } catch (e) {
        // ignore
      }

      if (!resolvedBranch && typeof candidate === 'string' && /^[0-9a-fA-F]{24}$/.test(candidate)) resolvedBranch = candidate;
      if (!resolvedBranch && typeof candidate === 'string') {
        const byCode = await Branch.findOne({ code: candidate }).select('_id').lean();
        if (byCode) resolvedBranch = byCode._id;
        else {
          const byName = await Branch.findOne({ name: new RegExp(`^${escapeRegExp(String(candidate))}$`, 'i') }).select('_id').lean() || await Branch.findOne({ name: new RegExp(escapeRegExp(String(candidate)), 'i') }).select('_id').lean();
          if (byName) resolvedBranch = byName._id;
        }
      }

      if (resolvedBranch) updateData.branch = resolvedBranch;
    }

    const updated = await Billing.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("branch", "name code location")
      .populate("salesPerson", "firstName lastName email")
      .populate("products");

    // NO CUSTOMER WHATSAPP FOR UPDATE

    res.status(200).json({
      success: true,
      message: "Billing updated successfully",
      billing: updated,
    });
  } catch (error) {
    console.error("Update billing error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE BILLING
export const deleteBilling = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id);
    if (!billing) {
      return res.status(404).json({ success: false, message: "Billing not found" });
    }

    const salesPersonId = billing.salesPerson;
    const billingDate = billing.createdAt;

    await billing.deleteOne();

    // Recalculate affected targets
    const affectedTargets = await Target.find({
      user: salesPersonId,
      startDate: { $lte: billingDate },
      endDate: { $gte: billingDate }
    });

    for (const target of affectedTargets) {
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
              salesPerson: target.user,
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
                salesPerson: target.user,
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
    }

    res.status(200).json({
      success: true,
      message: "Billing deleted successfully",
    });
  } catch (error) {
    console.error("Delete billing error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};



export const tallyBilling = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user._id) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Resolve branch: try multiple lookup strategies
    let branchId = user.branch;
    
    if (req.body.branch && typeof req.body.branch === 'string') {
      // Strategy 1: Try to find by ObjectId (if it's a valid MongoDB ID)
      if (req.body.branch.match(/^[0-9a-fA-F]{24}$/)) {
        const branchDoc = await Branch.findById(req.body.branch);
        if (branchDoc) {
          branchId = branchDoc._id;
        } else {
          return res.status(400).json({ 
            success: false, 
            message: `Branch with ID "${req.body.branch}" not found` 
          });
        }
      } else {
        // Strategy 2: Try to find by code
        let branchDoc = await Branch.findOne({ code: req.body.branch });
        
        // Strategy 3: Try to find by name (fallback)
        if (!branchDoc) {
          branchDoc = await Branch.findOne({ name: new RegExp(req.body.branch, 'i') });
        }
        
        if (!branchDoc) {
          // List available branches for debugging
          const availableBranches = await Branch.find({}, 'name code');
          return res.status(400).json({ 
            success: false, 
            message: `Branch "${req.body.branch}" not found`,
            availableBranches: availableBranches.map(b => ({ name: b.name, code: b.code }))
          });
        }
        
        branchId = branchDoc._id;
      }
    }

    // Validate branch is set
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch is required. Either set in request or ensure user has a default branch."
      });
    }

    // Build minimal billing data from request (no files expected here)
    const billingData = {
      ...req.body,
      salesPerson: user._id,
      branch: branchId,
      date: req.body.date || new Date(),
    };

    // Create billing
    const newBilling = await Billing.create(billingData);

    // Populate related fields to replace IDs with names
    const populated = await Billing.findById(newBilling._id)
      .populate('products', 'name model')
      .populate('branch', 'name')
      .populate('salesPerson', 'firstName lastName');

    // Build sanitized billing object without any IDs - only names and values
    const sanitized = {
      invoiceDate: new Date(populated.date).toLocaleDateString('en-IN'),
      companyName: populated.companyName || '',
      branchName: populated.branch?.name || '',
      salesPersonName: populated.salesPerson ? `${populated.salesPerson.firstName || ''} ${populated.salesPerson.lastName || ''}`.trim() : '',
      customerName: populated.customerName || '',
      address: populated.address || '',
      pinCode: populated.pinCode || '',
      contactPerson: populated.contactPerson || '',
      mobile: populated.mobile || '',
      phone: populated.phone || '',
      email: populated.email || '',
      gstNumber: populated.gstNumber || '',
      paymentModes: Array.isArray(populated.paymentMode) ? populated.paymentMode : [],
      totalAmount: populated.totalAmount || 0,
      products: Array.isArray(populated.products)
        ? populated.products.map(p => p?.model || 'Unknown Product')
        : [],
      createdAt: new Date(populated.createdAt).toLocaleDateString('en-IN'),
    };

    const tallyJSON = {
      action: 'create_invoice',
      data: sanitized,
    };

    return res.status(201).json({ success: true, message: 'Billing created and prepared for Tally', billing: sanitized, data: tallyJSON });
  } catch(err){
    console.error("Tally billing error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

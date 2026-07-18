import InventoryTransfer from "../models/inventoryTransfer.js";
import Product from "../models/product.js";
import Godown from "../models/godown.js";
import Branch from "../models/branch.js";

// Utility: normalize string for fuzzy comparisons across this controller
function normalizeForCompare(s) {
  if (!s) return "";
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}


export const createTransfer = async (req, res) => {
  try {
    console.log("RAW BODY RECEIVED:", req.body);

    const {
      date,
      items, // expected: [{ productId or product, quantity, batchNo }]
      product, // backward compatibility single product
      quantity, // backward compatibility single quantity
      sourceGodown,
      destinationGodown,
      batchNo // optional top-level
    } = req.body;

    // Normalize items: support legacy {product, quantity} and new items array
    let itemsToProcess = [];
    if (Array.isArray(items) && items.length > 0) {
      itemsToProcess = items.map((it) => ({
        productId: it.productId || it.product,
        quantity: Number(it.quantity),
        batchNo: it.batchNo || it.batchNo
      }));
    } else if (product && (quantity || quantity === 0)) {
      itemsToProcess = [{ productId: product, quantity: Number(quantity), batchNo }];
    }

    if (!itemsToProcess || itemsToProcess.length === 0) {
      return res.status(400).json({ message: "At least one item (product + quantity) is required" });
    }

    if (sourceGodown === destinationGodown) {
      return res.status(400).json({ message: "Source and Destination godown cannot be same" });
    }

    // Helper: resolve a godown value that may be a code, name or ObjectId
    const resolveGodown = async (val) => {
      if (!val) return null;

      // 1) try exact godown name match
      let g = await Godown.findOne({ name: val });
      if (g) return g;

      // 2) fallback: try as ObjectId for Godown
      try {
        g = await Godown.findById(val);
        if (g) return g;
      } catch (e) {
        // invalid ObjectId format — continue
      }

      // 3) If no Godown exists, try looking up Branch data and create a Godown from it
      // This allows using Branch codes/names directly as godowns (user preference)
      // try branch by code
      let b = await Branch.findOne({ code: val });
      if (!b) b = await Branch.findOne({ name: val });
      if (b) {
        // find existing Godown with same name as branch, or create one
        let existing = await Godown.findOne({ name: b.name });
        if (existing) return existing;

        const created = await Godown.create({ name: b.name, address: b.location || undefined });
        return created;
      }

      return null;
    };

    // small helper to escape user-provided string for regex
    function escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // normalize string for fuzzy matching (remove non-alphanumerics, lowercase)
    function normalizeForCompare(s) {
      if (!s) return "";
      return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    // Validate & resolve godowns (accepts codes, names or ObjectIds)
    const src = await resolveGodown(sourceGodown);
    if (!src) return res.status(404).json({ message: "Source Godown not found", value: sourceGodown });

    const dest = await resolveGodown(destinationGodown);
    if (!dest) return res.status(404).json({ message: "Destination Godown not found", value: destinationGodown });

    // Validate each product: accept either product ObjectId or product model/name
    const dbItems = [];
    for (const it of itemsToProcess) {
      if (!it.productId) {
        return res.status(400).json({ message: 'Product identifier is required for each item' });
      }

      let productDoc = null;
      // If looks like ObjectId, try finding by id
      if (/^[0-9a-fA-F]{24}$/.test(it.productId)) {
        productDoc = await Product.findById(it.productId);
      }

      // If not found by id, try flexible lookups by model, serialNumber, checkCode (case-insensitive exact, then contains, then normalized scan)
      if (!productDoc) {
        const queryVal = String(it.productId).trim();
        console.log(`Searching for product: '${queryVal}'`);
        
        // Try exact match on model
        productDoc = await Product.findOne({ model: { $regex: `^${escapeRegex(queryVal)}$`, $options: 'i' } });
        if (productDoc) console.log(`Found by exact model match: ${productDoc._id}`);
        
        // Try exact match on serialNumber
        if (!productDoc) {
          productDoc = await Product.findOne({ serialNumber: { $regex: `^${escapeRegex(queryVal)}$`, $options: 'i' } });
          if (productDoc) console.log(`Found by serialNumber match: ${productDoc._id}`);
        }
        
        // Try exact match on checkCode
        if (!productDoc) {
          productDoc = await Product.findOne({ checkCode: { $regex: `^${escapeRegex(queryVal)}$`, $options: 'i' } });
          if (productDoc) console.log(`Found by checkCode match: ${productDoc._id}`);
        }
        
        // Try contains match on model
        if (!productDoc) {
          productDoc = await Product.findOne({ model: { $regex: escapeRegex(queryVal), $options: 'i' } });
          if (productDoc) console.log(`Found by model contains: ${productDoc._id}`);
        }
        
        // Try normalized scan on model
        if (!productDoc) {
          const normalized = normalizeForCompare(queryVal);
          const all = await Product.find({ model: { $exists: true } }).select('model serialNumber checkCode');
          console.log(`Scanning ${all.length} products for normalized match...`);
          for (const p of all) {
            if (normalizeForCompare(p.model) === normalized || 
                normalizeForCompare(p.serialNumber) === normalized || 
                normalizeForCompare(p.checkCode) === normalized) {
              productDoc = await Product.findById(p._id);
              console.log(`Found by normalized match: ${productDoc._id}`);
              break;
            }
          }
        }
      }

      if (!productDoc) {
        console.error(`Product not found after all lookup attempts for: '${it.productId}'`);
        const sampleProducts = await Product.find().limit(3).select('model serialNumber checkCode');
        console.log('Sample products in DB:', JSON.stringify(sampleProducts, null, 2));
        return res.status(404).json({ message: `Product not found: ${it.productId}`, hint: 'Check server logs for available products' });
      }

      if (isNaN(it.quantity) || it.quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for product ${it.productId}` });
      }

      dbItems.push({ product: productDoc._id, quantity: it.quantity, batchNo: it.batchNo || undefined });
    }

    const transfer = await InventoryTransfer.create({
      date: date || new Date(),
      items: dbItems,
      sourceGodown: src._id,
      destinationGodown: dest._id,
      batchNo: batchNo || undefined,
      createdBy: req.user._id
    });

    // Populate product names and godown names for a user-friendly response
    const populated = await InventoryTransfer.findById(transfer._id)
      .populate('items.product', 'model serialNumber')
      .populate('sourceGodown', 'name')
      .populate('destinationGodown', 'name');

    const responsePayload = {
      date: populated.date,
      items: populated.items.map(it => ({
        name: it.product?.model || '',
        model: it.product?.model || '',
        serialNumber: it.product?.serialNumber || '',
        quantity: it.quantity,
        batchNo: it.batchNo || undefined
      })),
      sourceGodown: populated.sourceGodown?.name || '',
      destinationGodown: populated.destinationGodown?.name || '',
      batchNo: populated.batchNo,
      createdAt: populated.createdAt
    };

    res.status(201).json({ message: "Inventory transfer recorded successfully", data: responsePayload });
  } catch (error) {
    console.error("Inventory Transfer Error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


export const getAllInventoryTransfers = async (req, res) => {
  try {
    let query = {};
    
    // If user is not admin, only show transfers they created
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const transfers = await InventoryTransfer.find(query)
      .populate("items.product", "model serialNumber")
      .populate("sourceGodown", "name")
      .populate("destinationGodown", "name")
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Inventory transfers fetched successfully",
      data: transfers
    });
  } catch (error) {
    console.error("Inventory Transfer GET Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Export-to-Tally removed. Formerly exported exportTransferToTally.

// DELETE Inventory Transfer
export const deleteTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await InventoryTransfer.findById(id);
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    await transfer.deleteOne();

    res.status(200).json({ message: "Inventory transfer deleted successfully" });
  } catch (error) {
    console.error("Delete Inventory Transfer Error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// DELETE all inventory transfers (admin only)
export const deleteAllTransfers = async (req, res) => {
  try {
    const result = await InventoryTransfer.deleteMany({});
    return res.status(200).json({ message: `Deleted ${result.deletedCount} inventory transfers`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Delete All Inventory Transfers Error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const tallyCreateTransfer = async (req, res) => {
  try {
    console.log("RAW BODY RECEIVED (tallyCreateTransfer):", req.body);

    const {
      date,
      items,
      product,
      quantity,
      sourceGodown,
      destinationGodown,
      batchNo
    } = req.body;

    // Normalize items - just use the raw data
    let itemsToProcess = [];
    if (Array.isArray(items) && items.length > 0) {
      itemsToProcess = items.map(it => ({ 
        productName: it.productId || it.product || it.name,
        quantity: Number(it.quantity), 
        batchNo: it.batchNo 
      }));
    } else if (product && (quantity || quantity === 0)) {
      itemsToProcess = [{ productName: product, quantity: Number(quantity), batchNo }];
    }

    if (!itemsToProcess || itemsToProcess.length === 0) {
      return res.status(400).json({ success: false, message: "At least one item (product + quantity) is required" });
    }

    // Create inventory transfer with string data
    const transferData = {
      date: date || new Date(),
      items: itemsToProcess,
      sourceGodownName: sourceGodown,
      destinationGodownName: destinationGodown,
      batchNo: batchNo || ''
    };

    const savedTransfer = await InventoryTransfer.create({
      ...transferData,
      createdBy: req.user._id
    });

    // Build response with exact data from payload
    const responseData = {
      id: savedTransfer._id,
      date: savedTransfer.date,
      items: savedTransfer.items.map(it => ({
        product: it.productName,
        quantity: it.quantity,
        batchNo: it.batchNo || ''
      })),
      sourceGodown: savedTransfer.sourceGodownName,
      destinationGodown: savedTransfer.destinationGodownName,
      batchNo: savedTransfer.batchNo || '',
      createdAt: savedTransfer.createdAt
    };

    const tallyJSON = { 
      action: 'create_inventory_transfer', 
      data: responseData 
    };

    return res.status(201).json({ 
      success: true, 
      tallyJSON
    });
  } catch (error) {
    console.error('tallyCreateTransfer error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

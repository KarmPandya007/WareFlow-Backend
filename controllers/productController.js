import Product from "../models/product.js";
import ExcelJS from "exceljs";

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const { 
      name,
      category, 
      model, 
      serialNumber, 
      checkNumber, 
      demo, 
      branch, 
      srp, 
      supportedAmount, 
      supportedT2DBP,
      claimCode,
      programPeriod,
      cnToPartner,
      incentive,
      status 
    } = req.body;
    if (!name || !category || !model) {
      return res.status(400).json({ message: "Name, category and model are required" });
    }

    const normalize = {
      laptops: 'laptops',
      laptop: 'laptops',
      desktops: 'desktops',
      desktop: 'desktops',
      aios: 'aios',
      aio: 'aios',
      accessories: 'accessories',
      accessory: 'accessories'
    };

    const normalizedCategory = normalize[String(category).trim().toLowerCase()];
    if (!normalizedCategory) {
      return res.status(400).json({ message: `Invalid category '${category}'. Allowed: Laptops, Desktops, AIOs, accessories` });
    }

    const product = await Product.create({ 
      name,
      category: normalizedCategory, 
      model, 
      serialNumber, 
      checkNumber, 
      demo, 
      branch, 
      srp, 
      supportedAmount, 
      supportedT2DBP,
      claimCode,
      programPeriod,
      cnToPartner,
      incentive,
      status 
    });
    res.status(201).json({ success: true, product });  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all products
export const getProducts = async (req, res) => {
  try {
    const allProducts = await Product.find().lean();
    
    // Group products by category (DB uses plural category values)
    const laptops = allProducts.filter(p => p.category === "laptops");
    const desktops = allProducts.filter(p => p.category === "desktops");
    const aios = allProducts.filter(p => p.category === "aios");
    const accessories = allProducts.filter(p => p.category === "accessories");
    
    const totalCount = laptops.length + desktops.length + aios.length + accessories.length;

    res.status(200).json({ 
      success: true, 
      count: totalCount,
      products: {
        laptops,
        desktops,
        aios,
        accessories
      }
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    await product.deleteOne();
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Excel and update product supportedAmount
export const uploadProductsExcel = async (req, res) => {
  try {
    // Expect category in the multipart/form-data body. Normalize common frontend values
    const rawCategory = (req.body && req.body.category) ? req.body.category.toString().trim().toLowerCase() : null;
    if (!rawCategory) {
      return res.status(400).json({ success: false, message: "Category is required in the request body" });
    }

    const normalize = {
      laptops: 'laptops',
      laptop: 'laptops',
      desktops: 'desktops',
      desktop: 'desktops',
      aios: 'aios',
      aio: 'aios',
      accessories: 'accessories',
      accessory: 'accessories'
    };

    const category = normalize[rawCategory];
    if (!category) {
      return res.status(400).json({ success: false, message: `Invalid category '${req.body.category}'. Allowed: Laptops, Desktops, AIOs, accessories` });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "Excel file is required" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) {
      return res.status(400).json({ success: false, message: "No worksheet found in Excel file" });
    }
    // Get headers
    const headerRow = worksheet.getRow(1);
    const headerMap = {};
    headerRow.eachCell((cell, colNumber) => {
      let val = cell.value;
      if (val && typeof val === 'object') {
        val = val.result !== undefined ? val.result : (val.text || '');
      }
      const header = (val || '').toString().trim().toLowerCase();
      if (header) headerMap[header] = colNumber;
    });

    const products = [];
    const rowCount = worksheet.rowCount;
    
    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row.hasValues) continue;

      const getValue = (key) => {
        const idx = headerMap[key];
        if (!idx) return '';
        const cell = row.getCell(idx);
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object') {
          return cell.value.result !== undefined ? cell.value.result.toString().trim() : (cell.value.text || '').toString().trim();
        }
        return cell.value.toString().trim();
      };

      const product = {
        category,
        model: getValue('model') || '',
        serialNumber: getValue('serialnumber') || '',
        checkNumber: getValue('checknumber') || getValue('checkcode') || '',
        demo: getValue('demo') || '',
        branch: getValue('branch') || '',
        srp: parseFloat(getValue('srp')) || 0,
        supportedAmount: parseFloat(getValue('supportedamount')) || 0,
        supportedT2DBP: parseFloat(getValue('t2dbp')) || 0,
        claimCode: getValue('claimcode') || '',
        programPeriod: getValue('programperiod') || '',
        cnToPartner: parseFloat(getValue('cntopartner')) || 0,
        incentive: parseFloat(getValue('incentive')) || 0,
        status: getValue('status') || 'active'
      };

      // require a model at minimum (serialNumber optional but preferred)
      if (product.model) {
        products.push(product);
      }
    }

    if (products.length === 0) {
      return res.status(400).json({ success: false, message: "No valid product rows found in Excel" });
    }

    // Prepare bulk upsert operations (match by model + serialNumber when available)
    const ops = products.map(p => {
      const filter = { model: p.model };
      if (p.serialNumber) filter.serialNumber = p.serialNumber;
      return {
        updateOne: {
          filter,
          update: { $set: p },
          upsert: true
        }
      };
    });

    const result = await Product.bulkWrite(ops, { ordered: false });

    const upserted = result.upsertedCount || result.nUpserted || 0;
    const modified = result.modifiedCount || result.nModified || 0;
    const matched = result.matchedCount || result.nMatched || 0;

    res.status(200).json({ 
      success: true, 
      totalRows: products.length,
      upserted,
      modified,
      matched,
      message: `Processed ${products.length} rows (upserted ${upserted}, modified ${modified})`
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete all products (admin only)
export const deleteAllProducts = async (req, res) => {
  try {
    const result = await Product.deleteMany({});
    res.status(200).json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} products`, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("Delete all products error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete products by category (e.g., laptops, desktops, aios, accessories)
export const deleteProductsByCategory = async (req, res) => {
  try {
    const categoryParam = (req.params.category || '').toString().trim().toLowerCase();
    if (!categoryParam) {
      return res.status(400).json({ success: false, message: 'Category parameter is required' });
    }

    // Only allow these exact route params
    const allowedParams = ['laptops', 'desktops', 'aios', 'accessories'];
    if (!allowedParams.includes(categoryParam)) {
      return res.status(400).json({ success: false, message: `Invalid category. Allowed: ${allowedParams.join(', ')}` });
    }

    // route params are plural and map directly to DB category values
    const dbCategory = categoryParam;

    const result = await Product.deleteMany({ category: dbCategory });

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} products in category ${categoryParam}`,
      deletedCount: result.deletedCount,
      category: categoryParam
    });
  } catch (error) {
    console.error('Delete by category error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};



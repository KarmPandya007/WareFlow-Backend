import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Product from "../models/product.js";

// Function to read and parse Excel file
const readExcelFile = async (filePath, category) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    console.log(`  📊 Workbook has ${workbook.worksheets.length} worksheets`);
    workbook.worksheets.forEach((ws, i) => {
      console.log(`    Sheet ${i}: ${ws.name} - ${ws.rowCount} rows`);
    });
    const worksheet = workbook.worksheets[0];

    console.log(`  📋 Using sheet: ${worksheet.name} with ${worksheet.rowCount} rows`);

    // Get headers
    const headers = [];
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? cell.value.toString().trim().toLowerCase() : '';
    });

    const columnMap = {};
    headers.forEach((header, index) => {
      if (header) columnMap[header] = index;
    });

    console.log(`  📋 Columns: ${Object.keys(columnMap).filter(k => k).join(", ")}`);

    // Parse products
    const products = [];
    try {
      const rowCount = worksheet.rowCount;
      console.log(`  🔍 Processing ${rowCount - 1} data rows`);
      for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row.hasValues) continue;

        const product = {
          category,
          model: (row.values[columnMap["model"]] || "").toString().trim() || "",
          serialNumber: (row.values[columnMap["serialnumber"]] || "").toString().trim() || "",
          checkNumber: (row.values[columnMap["checknumber"] ?? columnMap["checkcode"]] || "").toString().trim() || "",
          demo: (row.values[columnMap["demo"]] || "").toString().trim() || "",
          branch: (row.values[columnMap["branch"]] || "").toString().trim() || "",
          srp: parseFloat(row.values[columnMap["srp"]]) || 0,
          supportedAmount: parseFloat(row.values[columnMap["supportedamount"]]) || 0,
          supportedT2DBP: parseFloat(row.values[columnMap["t2dbp"]]) || 0,
          claimCode: (row.values[columnMap["claimcode"]] || "").toString().trim() || "",
          programPeriod: (row.values[columnMap["programperiod"]] || "").toString().trim() || "",
          cnToPartner: parseFloat(row.values[columnMap["cntopartner"]]) || 0,
          status: "active"
        };

        products.push(product);
      }
    } catch (error) {
      console.log(`Error parsing rows for ${filePath}: ${error.message}`);
    }

    console.log(`  ✅ Parsed ${products.length} products from ${filePath}`);

    return products;
  } catch (error) {
    console.error(`❌ Error reading ${filePath}: ${error.message}`);
    throw error;
  }
};

// Import Function
const importProducts = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected\n");

    // Define Excel files and their categories (plural category values)
    const files = [
      { name: "STOCK NB AS 19-12-25.xlsx", category: "laptops" },
      { name: "STOCK DT AS 19-12-25.xlsx", category: "desktops" },
      { name: "STOCK AIO AS 19-12-25.xlsx", category: "aios" }
    ];

    let allProducts = [];

    // Read all Excel files
    for (const file of files) {
      const filePath = path.join(__dirname, "data", file.name);
      
      try {
        console.log(`📂 Reading ${file.name}...`);
        const products = await readExcelFile(filePath, file.category);
        console.log(`  ✅ Found ${products.length} ${file.category}\n`);
        allProducts = allProducts.concat(products);
      } catch (error) {
        console.log(`  ⚠️  File not found: ${file.name}`);
        console.log(`  💡 Place the file in: ${filePath}\n`);
      }
    }

    if (allProducts.length === 0) {
      console.log("❌ No products found in any Excel files");
      process.exit(0);
    }

    console.log(`📊 Total products to import: ${allProducts.length}`);

    // Check existing products
    const existingCount = await Product.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Database has ${existingCount} products.`);
      
      if (!process.argv.includes("--force")) {
        console.log("❌ Import cancelled. Use --force to delete existing and reimport.");
        console.log("💡 Run: node importExcel.js --force");
        process.exit(0);
      }
      
      console.log("🗑️  Deleting existing products...");
      await Product.deleteMany({});
      console.log("✅ Deleted all existing products\n");
    }

    // Insert products
    console.log("⬆️  Importing products to database...");
    try {
      const result = await Product.insertMany(allProducts);
      
      // Count by category
      const laptops = result.filter(p => p.category === "laptops").length;
      const desktops = result.filter(p => p.category === "desktops").length;
      const aios = result.filter(p => p.category === "aios").length;
      
      console.log(`\n✅ Successfully imported ${result.length} products!`);
      console.log(`   💻 Laptops: ${laptops}`);
      console.log(`   🖥️  Desktops: ${desktops}`);
      console.log(`   🖥️  AIOs: ${aios}`);
    } catch (error) {
      console.error("❌ Error inserting products:", error.message);
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

importProducts();

import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Product model
import Product from "../models/product.js";

// Function to read and parse Excel file
const readExcelFile = async (filePath, category) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Determine header row
    let headerRow = 1;
    if (category === "aios") headerRow = 2;

    // Get headers
    const headers = [];
    worksheet.getRow(headerRow).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? cell.value.toString().trim().toLowerCase() : "";
    });

    const columnMap = {};
    headers.forEach((header, index) => {
      if (header) columnMap[header] = index;
    });

    console.log(`  📋 Columns: ${Object.keys(columnMap).filter(k => k).join(", ")}`);

    // Helper function to get cell value, handling formulas
    const getCellValue = (cell) => {
      if (!cell || !cell.value) return "";
      if (typeof cell.value === "object" && cell.value.result !== undefined) {
        return cell.value.result; // For formula cells
      }
      return cell.value;
    };

    // Parse products
    const products = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === headerRow) return; // Skip header

      let product = {
        category: category,
        model: row.getCell(columnMap["model"])?.value?.toString().trim() || "",
        supportedAmount: parseFloat(getCellValue(row.getCell(columnMap["supportedamount"]))) || 0,
        srp: parseFloat(getCellValue(row.getCell(columnMap["srp"]))) || 0,
        cnToPartner: parseFloat(getCellValue(row.getCell(columnMap["cntopartner"]))) || 0,
        programPeriod: row.getCell(columnMap["programperiod"])?.value?.toString().trim() || "",
        claimCode: row.getCell(columnMap["claimcode"])?.value?.toString().trim() || "",
        status: "active"
      };

      // Only add if model is not empty
      if (product.model) {
        products.push(product);
      }
    });

    return products;
  } catch (error) {
    console.error(`❌ Error processing ${category} file:`, error.message);
    return []; // Return empty array on error
  }
};

// Import Function
const importActivationSupport = async () => {
  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected\n");

    // Define Excel files and their categories (plural)
    const files = [
      { name: "NOTEBOOK ACTIVATION SUPPORT FOR ADMIN.xlsx", category: "laptops" },
      { name: "DESKTOP ACTIVATION SUPPORT FOR ADMIN.xlsx", category: "desktops" },
      { name: "ALL IN ONE ACTIVATION SUPPORT FOR ADMIN.xlsx", category: "aios" }
    ];

    let allProducts = [];

    // Read all Excel files
    for (const file of files) {
      const filePath = path.join(__dirname, "data", file.name);
      
      console.log(`📂 Reading ${file.name}...`);
      const products = await readExcelFile(filePath, file.category);
      console.log(`  ✅ Found ${products.length} ${file.category}\n`);
      allProducts = allProducts.concat(products);
    }

    if (allProducts.length === 0) {
      console.log("❌ No products found in any Excel file");
      process.exit(0);
    }

    console.log(`📊 Total products to import: ${allProducts.length}`);

    // Insert all products
    console.log("⬆️  Importing products to database...");
    const result = await Product.insertMany(allProducts, { ordered: false });

    console.log(`\n✅ Successfully imported ${result.length} products!`);

    // Summary
    const laptops = result.filter(p => p.category === "laptops").length;
    const desktops = result.filter(p => p.category === "desktops").length;
    const aios = result.filter(p => p.category === "aios").length;

    console.log(`   💻 Laptops: ${laptops}`);
    console.log(`   🖥️  Desktops: ${desktops}`);
    console.log(`   🖥️  AIOs: ${aios}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.code === 11000) {
      console.log("⚠️  Some products already exist (duplicate key error)");
    }
    process.exit(1);
  }
};

importActivationSupport();
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to read products from Excel file
const readProducts = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  // Get headers
  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value ? cell.value.toString().trim().toLowerCase() : '';
  });

  const columnMap = {};
  headers.forEach((header, index) => {
    if (header) columnMap[header] = index;
  });

  // Parse products
  const products = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const product = {
      model: row.getCell(columnMap["model"])?.value?.toString().trim() || "",
      serialNumber: row.getCell(columnMap["serialnumber"])?.value?.toString().trim() || "",
      checkNumber: row.getCell(columnMap["checknumber"] || columnMap["checkcode"])?.value?.toString().trim() || "",
      demo: row.getCell(columnMap["demo"])?.value?.toString().trim() || "",
      srp: parseFloat(row.getCell(columnMap["srp"])?.value) || 0,
      supportedAmount: parseFloat(row.getCell(columnMap["supportedamount"])?.value) || 0,
      claimCode: row.getCell(columnMap["claimcode"])?.value?.toString().trim() || "",
      programPeriod: row.getCell(columnMap["programperiod"])?.value?.toString().trim() || "",
      cnToPartner: parseFloat(row.getCell(columnMap["cntopartner"])?.value) || 0,
    };

    products.push(product);
  });

  return products;
};

// Files to check (categories are plural)
const files = [
  { name: "STOCK NB AS 19-12-25.xlsx", category: "laptops" },
  { name: "STOCK DT AS 19-12-25.xlsx", category: "desktops" },
  { name: "STOCK AIO AS 19-12-25.xlsx", category: "aios" }
];

const main = async () => {
  for (const file of files) {
    const filePath = path.join(__dirname, "data", file.name);
    try {
      console.log(`\n📂 Reading products from ${file.name} (${file.category}):`);
      const products = await readProducts(filePath);
      console.log(`Found ${products.length} products:`);
      products.forEach((p, i) => {
        console.log(`${i + 1}. Model: ${p.model}, Serial: ${p.serialNumber}, Check: ${p.checkNumber}, SRP: ${p.srp}`);
      });
    } catch (error) {
      console.log(`❌ Error reading ${file.name}: ${error.message}`);
    }
  }
};

main();
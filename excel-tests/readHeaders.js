import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to read headers from Excel file
const readHeaders = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  // Get headers
  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value ? cell.value.toString().trim() : '';
  });

  // Count rows
  let rowCount = 0;
  worksheet.eachRow(() => {
    rowCount++;
  });

  return { headers: headers.filter(h => h), rowCount: rowCount - 1 }; // -1 for header
};

// Files to check
const files = [
  "STOCK NB AS 19-12-25.xlsx",
  "STOCK DT AS 19-12-25.xlsx",
  "STOCK AIO AS 19-12-25.xlsx"
];

const main = async () => {
  for (const file of files) {
    const filePath = path.join(__dirname, "data", file);
    try {
      console.log(`\n📂 Reading ${file}:`);
      const { headers, rowCount } = await readHeaders(filePath);
      console.log(`Headers: ${headers.join(", ")}`);
      console.log(`Data rows: ${rowCount}`);
    } catch (error) {
      console.log(`❌ Error reading ${file}: ${error.message}`);
    }
  }
};

main();
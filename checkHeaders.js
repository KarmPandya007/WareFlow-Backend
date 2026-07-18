import ExcelJS from "exceljs";

const checkExcelHeaders = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("NB STOCK 2-3-26.xlsx");
    const worksheet = workbook.worksheets[0];

    console.log("📋 Excel Headers:");
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      console.log(`   Column ${colNumber}: "${cell.value}"`);
    });

    console.log("\n📊 Sample Row 2:");
    const row2 = worksheet.getRow(2);
    row2.eachCell((cell, colNumber) => {
      console.log(`   Column ${colNumber}: "${cell.value}"`);
    });

    console.log("\n📊 Sample Row 3:");
    const row3 = worksheet.getRow(3);
    row3.eachCell((cell, colNumber) => {
      console.log(`   Column ${colNumber}: "${cell.value}"`);
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

checkExcelHeaders();

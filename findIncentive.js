import ExcelJS from "exceljs";

const findIncentiveData = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("NB STOCK 2-3-26.xlsx");
    const worksheet = workbook.worksheets[0];

    const headerRow = worksheet.getRow(1);
    let incentiveCol = null;
    headerRow.eachCell((cell, colNumber) => {
      const header = (cell.value || "").toString().trim().toLowerCase();
      if (header.includes("incentive")) {
        incentiveCol = colNumber;
        console.log(`✅ Found incentive column: "${cell.value}" at column ${colNumber}`);
      }
    });

    if (!incentiveCol) {
      console.log("❌ No incentive column found");
      return;
    }

    console.log("\n📊 Rows with incentive values:");
    let count = 0;
    for (let i = 2; i <= worksheet.rowCount && count < 10; i++) {
      const row = worksheet.getRow(i);
      const incentiveValue = row.getCell(incentiveCol).value;
      if (incentiveValue && incentiveValue !== "" && incentiveValue !== 0) {
        console.log(`   Row ${i}: Model="${row.getCell(1).value}", Incentive="${incentiveValue}"`);
        count++;
      }
    }

    if (count === 0) {
      console.log("   ⚠️ No rows found with incentive values");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

findIncentiveData();

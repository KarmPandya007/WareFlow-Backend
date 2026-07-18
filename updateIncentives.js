import ExcelJS from "exceljs";
import Product from "./models/product.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();
connectDB();

const updateIncentivesFromExcel = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile("NB STOCK 2-3-26.xlsx");
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      console.log("❌ No worksheet found");
      return;
    }

    const headerRow = worksheet.getRow(1);
    const headerMap = {};
    headerRow.eachCell((cell, colNumber) => {
      const header = (cell.value || "").toString().trim().toLowerCase();
      if (header) headerMap[header] = colNumber;
    });

    const products = [];
    const rowCount = worksheet.rowCount;

    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row.hasValues) continue;

      const getValue = (key) => {
        const idx = headerMap[key];
        if (!idx) return "";
        const val = row.values[idx];
        return val === null || val === undefined ? "" : val.toString().trim();
      };

      const model = getValue("model") || "";
      const serialNumber = getValue("serial") || "";
      const incentive = parseFloat(getValue("aeging incentive amount")) || 0;

      if (model) {
        products.push({
          category: "laptops",
          name: model,
          model,
          serialNumber,
          checkNumber: getValue("part") || "",
          demo: "",
          branch: getValue("branch") || "",
          srp: parseFloat(getValue("srp")) || 0,
          supportedAmount: parseFloat(getValue("support on srp")) || 0,
          supportedT2DBP: parseFloat(getValue("supported t2 dbp")) || 0,
          claimCode: getValue("claim code") || "",
          programPeriod: getValue("program period") || "",
          cnToPartner: parseFloat(getValue("cn\nper unit")) || parseFloat(getValue("cn per unit")) || 0,
          incentive,
          status: "active"
        });
      }
    }

    console.log(`📊 Found ${products.length} products in Excel`);

    const ops = products.map((p) => {
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

    console.log(`✅ Success!`);
    console.log(`   Upserted: ${result.upsertedCount || 0}`);
    console.log(`   Modified: ${result.modifiedCount || 0}`);
    console.log(`   Matched: ${result.matchedCount || 0}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

updateIncentivesFromExcel();

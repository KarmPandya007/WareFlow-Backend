import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import fs from "fs";
import path from "path";

// Import all models
import AdvanceBooking from "./models/advanceBooking.js";
import Billing from "./models/billing.js";
import Branch from "./models/branch.js";
import Godown from "./models/godown.js";
import InventoryTransfer from "./models/inventoryTransfer.js";
import Ledger from "./models/ledger.js";
import Product from "./models/product.js";
import QRUpload from "./models/QRUpload.js";
import SalesPerson from "./models/salesPerson.js";
import Target from "./models/target.js";
import User from "./models/User.js";

const EXPORT_DIR = path.join(process.cwd(), "db_exports");

const collectionMapping = {
  "advancebookings": { model: AdvanceBooking, name: "AdvanceBooking" },
  "billings": { model: Billing, name: "Billing" },
  "branches": { model: Branch, name: "Branch" },
  "godowns": { model: Godown, name: "Godown" },
  "inventorytransfers": { model: InventoryTransfer, name: "InventoryTransfer" },
  "ledgers": { model: Ledger, name: "Ledger" },
  "products": { model: Product, name: "Product" },
  "qruploads": { model: QRUpload, name: "QRUpload" },
  "salespeople": { model: SalesPerson, name: "SalesPerson" },
  "targets": { model: Target, name: "Target" },
  "users": { model: User, name: "User" }
};

// Robust character-by-character CSV parser
function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentVal += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
      i++;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      currentRow.push(currentVal);
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
      i++;
      if (char === '\r' && content[i] === '\n') {
        i++;
      }
    } else {
      currentVal += char;
      i++;
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }
  return rows;
}

// Unflatten dotted object keys (e.g. { "a.b": 1 } -> { a: { b: 1 } })
function unflattenObject(flatObj) {
  const result = {};
  for (const key in flatObj) {
    const keys = key.split('.');
    let current = result;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (i === keys.length - 1) {
        current[k] = flatObj[key];
      } else {
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
    }
  }
  return result;
}

// Recursively cast ObjectIds and Dates inside parsed JSON arrays/objects
function castParsedJSON(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(val)) {
      return new mongoose.Types.ObjectId(val);
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(val)) {
      return new Date(val);
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(castParsedJSON);
  }
  if (typeof val === 'object') {
    const result = {};
    for (const key in val) {
      result[key] = castParsedJSON(val[key]);
    }
    return result;
  }
  return val;
}

// Cast cell values dynamically based on Mongoose schema rules and type guessing fallbacks
function castField(model, key, val) {
  if (val === undefined || val === null || val === '') {
    return undefined; // omit empty fields
  }

  // Primary key check
  if (key === '_id') {
    return new mongoose.Types.ObjectId(val);
  }

  const schema = model ? model.schema : null;
  const pathObj = schema ? schema.path(key) : null;

  if (pathObj) {
    const instance = pathObj.instance;

    if (instance === 'ObjectId' || instance === 'ObjectID') {
      return new mongoose.Types.ObjectId(val);
    }

    if (instance === 'Date') {
      return new Date(val);
    }

    if (instance === 'Number') {
      const num = Number(val);
      return isNaN(num) ? val : num;
    }

    if (instance === 'Boolean') {
      return val === 'true' || val === true;
    }

    if (instance === 'Array') {
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          const parsed = JSON.parse(val);
          return castParsedJSON(parsed);
        } catch (e) {
          // ignore parsing error, proceed to fallback
        }
      }

      if (val.includes(' | ')) {
        const parts = val.split(' | ');
        const caster = pathObj.caster;
        if (caster) {
          if (caster.instance === 'ObjectId' || caster.instance === 'ObjectID') {
            return parts.map(p => new mongoose.Types.ObjectId(p));
          }
          if (caster.instance === 'Number') {
            return parts.map(p => {
              const num = Number(p);
              return isNaN(num) ? p : num;
            });
          }
        }
        return parts;
      }

      if (val === '[]') {
        return [];
      }

      const caster = pathObj.caster;
      if (caster) {
        if (caster.instance === 'ObjectId' || caster.instance === 'ObjectID') {
          return [new mongoose.Types.ObjectId(val)];
        }
        if (caster.instance === 'Number') {
          const num = Number(val);
          return [isNaN(num) ? val : num];
        }
      }
      return [val];
    }
  }

  // Fallback heuristic type guessing (for legacy or unmapped fields)
  if (/^[0-9a-fA-F]{24}$/.test(val)) {
    return new mongoose.Types.ObjectId(val);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(val)) {
    return new Date(val);
  }

  if (val === 'true') return true;
  if (val === 'false') return false;

  if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
    try {
      const parsed = JSON.parse(val);
      return castParsedJSON(parsed);
    } catch (e) {
      // ignore parsing error, proceed
    }
  }

  if (val.includes(' | ')) {
    const parts = val.split(' | ');
    return parts.map(p => {
      if (/^[0-9a-fA-F]{24}$/.test(p)) {
        return new mongoose.Types.ObjectId(p);
      }
      return p;
    });
  }

  // Auto-cast numeric keys
  const numKeys = ["amount", "price", "quantity", "total", "size", "sum", "rate", "percent", "count", "remaining", "advance", "target"];
  const lowerKey = key.toLowerCase();
  const isNumberLikeKey = numKeys.some(nk => lowerKey.includes(nk));
  if (!isNaN(val) && val.trim() !== "") {
    if (isNumberLikeKey || val.length < 6) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }

  return val;
}

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   URI: ${process.env.MONGO_URI?.substring(0, 45)}...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const db = mongoose.connection.db;

  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`❌ Export directory does not exist: ${EXPORT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(EXPORT_DIR).filter(file => file.endsWith(".csv"));
  console.log(`📂 Found ${files.length} CSV files to import\n`);

  const summary = [];

  for (const file of files) {
    const collectionName = path.basename(file, ".csv");
    const filepath = path.join(EXPORT_DIR, file);
    
    console.log(`--------------------------------------------------`);
    console.log(`📄 Processing ${file} -> collection: ${collectionName}...`);

    const content = fs.readFileSync(filepath, "utf-8");
    if (!content.trim()) {
      console.log(`   ⚠️ File is empty, skipping.`);
      summary.push({ collection: collectionName, file, imported: 0, status: "Skipped (empty)" });
      continue;
    }

    const rows = parseCSV(content);
    if (rows.length < 2) {
      console.log(`   ⚠️ No data rows found, skipping.`);
      summary.push({ collection: collectionName, file, imported: 0, status: "Skipped (no data)" });
      continue;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const documents = [];

    const mapping = collectionMapping[collectionName];
    const model = mapping ? mapping.model : null;

    if (!model) {
      console.log(`   ⚠️ Warning: No Mongoose model mapped for collection "${collectionName}". Importing with fallback types.`);
    }

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      // Skip empty rows
      if (row.length === 0 || (row.length === 1 && row[0] === '')) {
        continue;
      }

      const flatDoc = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        const val = row[c];
        const casted = castField(model, key, val);
        if (casted !== undefined) {
          flatDoc[key] = casted;
        }
      }

      const unflattened = unflattenObject(flatDoc);
      documents.push(unflattened);
    }

    if (documents.length === 0) {
      console.log(`   ⚠️ No valid documents parsed, skipping.`);
      summary.push({ collection: collectionName, file, imported: 0, status: "Skipped (no valid docs)" });
      continue;
    }

    console.log(`   Parsed ${documents.length} documents. Inserting into database...`);

    // Drop collection if it exists to ensure clean restore (since database should be initialized with this clean state)
    try {
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length > 0) {
        console.log(`   🗑️ Dropping existing collection "${collectionName}"...`);
        await db.collection(collectionName).drop();
      }
    } catch (err) {
      console.log(`   ⚠️ Note: Could not drop collection "${collectionName}": ${err.message}`);
    }

    // Insert using native MongoDB collections to bypass Mongoose validation rules on legacy records
    const result = await db.collection(collectionName).insertMany(documents);
    console.log(`   ✅ Successfully imported ${result.insertedCount} documents.`);
    summary.push({ collection: collectionName, file, imported: result.insertedCount, status: "Success" });
  }

  // Print final summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 IMPORT SUMMARY");
  console.log("=".repeat(60));
  
  const maxNameLen = Math.max(...summary.map(s => s.collection.length), 10);
  console.log(
    `${"Collection".padEnd(maxNameLen)}  ${"Imported".padStart(8)}  Status`
  );
  console.log(`${"-".repeat(maxNameLen)}  ${"-".repeat(8)}  ${"-".repeat(20)}`);

  let totalImported = 0;
  for (const s of summary) {
    console.log(
      `${s.collection.padEnd(maxNameLen)}  ${String(s.imported).padStart(8)}  ${s.status}`
    );
    totalImported += s.imported;
  }
  console.log(`${"-".repeat(maxNameLen)}  ${"-".repeat(8)}  ${"-".repeat(20)}`);
  console.log(`TOTAL IMPORTED: ${totalImported} documents across ${summary.filter(s => s.imported > 0).length} collections.`);
  console.log("=".repeat(60) + "\n");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

main().catch((err) => {
  console.error("❌ Import failed:", err.stack);
  process.exit(1);
});

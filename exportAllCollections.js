import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const EXPORT_DIR = path.join(process.cwd(), "db_exports");

// Flatten nested objects for CSV (e.g., { a: { b: 1 } } -> { "a.b": 1 })
function flattenObject(obj, prefix = "", result = {}) {
  if (obj === null || obj === undefined) {
    result[prefix] = "";
    return result;
  }

  if (obj instanceof Date) {
    result[prefix] = obj.toISOString();
    return result;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      result[prefix] = "[]";
    } else {
      // For arrays of primitives, join them; for arrays of objects, JSON stringify
      const allPrimitive = obj.every(
        (item) => typeof item !== "object" || item === null
      );
      if (allPrimitive) {
        result[prefix] = obj.join(" | ");
      } else {
        result[prefix] = JSON.stringify(obj);
      }
    }
    return result;
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      result[prefix] = "{}";
      return result;
    }
    for (const key of keys) {
      if (key === "__v") continue; // skip version key
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(obj[key], newPrefix, result);
    }
    return result;
  }

  result[prefix] = String(obj);
  return result;
}

// Escape CSV value
function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert array of objects to CSV string
function toCSV(docs) {
  if (!docs || docs.length === 0) return "";

  // Flatten all documents
  const flatDocs = docs.map((doc) => flattenObject(doc));

  // Collect all unique headers
  const headerSet = new Set();
  flatDocs.forEach((doc) => {
    Object.keys(doc).forEach((key) => headerSet.add(key));
  });

  // Sort headers, but put _id first
  const headers = Array.from(headerSet);
  headers.sort((a, b) => {
    if (a === "_id") return -1;
    if (b === "_id") return 1;
    return a.localeCompare(b);
  });

  // Build CSV
  const lines = [];
  lines.push(headers.map(escapeCSV).join(","));

  for (const doc of flatDocs) {
    const row = headers.map((h) => escapeCSV(doc[h] ?? ""));
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   URI: ${process.env.MONGO_URI?.substring(0, 40)}...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const db = mongoose.connection.db;

  // List all collections
  const collections = await db.listCollections().toArray();
  console.log(`📦 Found ${collections.length} collections:\n`);

  // Create export directory
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const summary = [];

  for (const collInfo of collections) {
    const collName = collInfo.name;
    const collection = db.collection(collName);
    const count = await collection.countDocuments();
    const docs = await collection.find({}).toArray();

    console.log(`  📄 ${collName}: ${count} documents`);

    if (count === 0) {
      summary.push({ collection: collName, documents: 0, file: "(empty — skipped)" });
      continue;
    }

    // Convert ObjectIds and Dates to strings for CSV
    const cleanDocs = docs.map((doc) => JSON.parse(JSON.stringify(doc)));

    const csv = toCSV(cleanDocs);
    const filename = `${collName}.csv`;
    const filepath = path.join(EXPORT_DIR, filename);

    fs.writeFileSync(filepath, csv, "utf-8");

    summary.push({ collection: collName, documents: count, file: filename });
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 EXPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Export directory: ${EXPORT_DIR}\n`);

  const maxNameLen = Math.max(...summary.map((s) => s.collection.length), 10);
  console.log(
    `${"Collection".padEnd(maxNameLen)}  ${"Docs".padStart(6)}  File`
  );
  console.log(`${"-".repeat(maxNameLen)}  ${"-".repeat(6)}  ${"-".repeat(30)}`);

  let totalDocs = 0;
  for (const s of summary) {
    console.log(
      `${s.collection.padEnd(maxNameLen)}  ${String(s.documents).padStart(6)}  ${s.file}`
    );
    totalDocs += s.documents;
  }

  console.log(`${"-".repeat(maxNameLen)}  ${"-".repeat(6)}  ${"-".repeat(30)}`);
  console.log(
    `${"TOTAL".padEnd(maxNameLen)}  ${String(totalDocs).padStart(6)}  ${summary.filter((s) => s.documents > 0).length} files`
  );
  console.log("\n✅ All collections exported successfully!");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

main().catch((err) => {
  console.error("❌ Export failed:", err.message);
  process.exit(1);
});

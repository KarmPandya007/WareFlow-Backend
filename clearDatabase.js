import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

async function main() {
  console.log("🔌 Connecting to MongoDB...");
  console.log(`   URI: ${process.env.MONGO_URI?.substring(0, 45)}...`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const db = mongoose.connection.db;

  // List all collections
  const collections = await db.listCollections().toArray();
  console.log(`📦 Found ${collections.length} collections to drop\n`);

  for (const collInfo of collections) {
    const collName = collInfo.name;
    // Skip system/index collections just in case
    if (collName.startsWith("system.")) {
      continue;
    }
    
    console.log(`🗑️ Dropping collection: ${collName}...`);
    try {
      await db.collection(collName).drop();
      console.log(`   ✅ Dropped.`);
    } catch (err) {
      console.error(`   ❌ Failed to drop collection "${collName}": ${err.message}`);
    }
  }

  console.log("\n✅ Database cleared successfully!");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

main().catch((err) => {
  console.error("❌ Clear failed:", err.stack);
  process.exit(1);
});

import Product from "./models/product.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";

dotenv.config();
connectDB();

const removeDuplicates = async () => {
  try {
    const allProducts = await Product.find();
    console.log(`📊 Total products: ${allProducts.length}`);

    const seen = new Map();
    const duplicateIds = [];

    for (const product of allProducts) {
      const key = `${product.model}|${product.serialNumber}`;
      
      if (seen.has(key)) {
        duplicateIds.push(product._id);
      } else {
        seen.set(key, product._id);
      }
    }

    console.log(`🔍 Found ${duplicateIds.length} duplicates`);

    if (duplicateIds.length > 0) {
      const result = await Product.deleteMany({ _id: { $in: duplicateIds } });
      console.log(`✅ Deleted ${result.deletedCount} duplicate products`);
    } else {
      console.log(`✅ No duplicates found`);
    }

    const remaining = await Product.countDocuments();
    console.log(`📊 Remaining products: ${remaining}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

removeDuplicates();

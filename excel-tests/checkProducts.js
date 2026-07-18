import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Product from "../models/product.js";

const checkProducts = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected\n");

    const total = await Product.countDocuments();
    const laptops = await Product.countDocuments({ category: "laptops" });
    const desktops = await Product.countDocuments({ category: "desktops" });
    const aios = await Product.countDocuments({ category: "aios" });

    console.log(`📊 Total products: ${total}`);
    console.log(`💻 Laptops: ${laptops}`);
    console.log(`🖥️ Desktops: ${desktops}`);
    console.log(`🖥️ AIOs: ${aios}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

checkProducts();
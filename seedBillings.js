import dotenv from "dotenv";
import mongoose from "mongoose";
import Billing from "./models/billing.js";
import Branch from "./models/branch.js";
import Product from "./models/product.js";
import User from "./models/User.js";

dotenv.config();

const DEFAULT_COUNT = 35;
const MIN_COUNT = 30;
const MAX_COUNT = 40;

const firstNames = [
  "Aarav", "Aditi", "Arjun", "Diya", "Ishaan", "Kavya", "Manav", "Meera",
  "Neha", "Nikhil", "Pooja", "Rahul", "Riya", "Rohan", "Sneha", "Vivek",
];
const lastNames = [
  "Desai", "Gupta", "Iyer", "Jain", "Joshi", "Kapoor", "Mehta", "Patel",
  "Rao", "Shah", "Sharma", "Singh", "Trivedi", "Verma",
];
const cities = [
  "Ahmedabad", "Anand", "Gandhinagar", "Rajkot", "Surat", "Vadodara",
];
const referralSources = [
  "Social Media Platform", "Google", "Friends/Family", "Old Customer",
];

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const roundCurrency = (value) => Math.round(value * 100) / 100;

const parseCount = () => {
  const countArgument = process.argv.find((arg) => /^--count=/.test(arg));
  const positionalArgument = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
  const rawCount = countArgument?.split("=")[1] ?? positionalArgument ?? DEFAULT_COUNT;
  const count = Number(rawCount);

  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    throw new Error(`Billing count must be an integer between ${MIN_COUNT} and ${MAX_COUNT}.`);
  }

  return count;
};

const makePayments = (totalAmount, index) => {
  switch (index % 7) {
    case 0:
      return [{ mode: "Cash", amount: totalAmount }];
    case 1:
      return [{
        mode: "UPI",
        amount: totalAmount,
        upiProvider: "PhonePe",
        upiTransactionId: `UPI-SEED-${Date.now()}-${index}`,
      }];
    case 2:
      return [{
        mode: "Bank",
        amount: totalAmount,
        bankType: "NEFT",
        utrNumber: `UTRSEED${String(index).padStart(5, "0")}`,
      }];
    case 3:
      return [{
        mode: "Machine",
        amount: totalAmount,
        machineProvider: "Pinelabs",
        machineCardType: "Credit Card",
        machineCardLast4Digits: String(1000 + index).slice(-4),
        machineTransactionId: `POS-SEED-${index}`,
      }];
    case 4: {
      const cashAmount = roundCurrency(totalAmount * 0.35);
      return [
        { mode: "Cash", amount: cashAmount },
        {
          mode: "UPI",
          amount: roundCurrency(totalAmount - cashAmount),
          upiProvider: "PhonePe",
          upiTransactionId: `UPI-SPLIT-SEED-${index}`,
        },
      ];
    }
    case 5:
      return [{
        mode: "Bajaj Finance",
        amount: totalAmount,
        loanAmount: totalAmount,
        loanId: `LOAN-SEED-${String(index).padStart(4, "0")}`,
      }];
    default:
      return [{
        mode: "Brand Order",
        amount: totalAmount,
        brandOrderType: index % 2 === 0 ? "Lenovo OMO" : "Asus Eshop",
      }];
  }
};

const buildBillings = ({ count, branches, products, users }) => {
  const runId = new Date().toISOString();

  return Array.from({ length: count }, (_, index) => {
    const selectedProducts = [...products]
      .sort(() => Math.random() - 0.5)
      .slice(0, randomInt(1, Math.min(3, products.length)));
    const productTotal = selectedProducts.reduce(
      (sum, product) => sum + Number(product.price || product.srp || product.supportedAmount || 15000),
      0,
    );
    const totalAmount = roundCurrency(Math.max(productTotal, randomInt(12000, 95000)));
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const city = randomItem(cities);
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - randomInt(0, 120));
    createdDate.setHours(randomInt(9, 20), randomInt(0, 59), randomInt(0, 59), 0);

    return {
      companyName: index % 3 === 0 ? "Karm Demo Enterprises" : "WareFlow Demo Store",
      branch: randomItem(branches)._id,
      salesPerson: randomItem(users)._id,
      date: createdDate,
      salesType: index % 5 === 0 ? "Corporate" : "Retail",
      customerName: `${firstName} ${lastName}`,
      address: `${randomInt(1, 499)}, ${randomItem(["MG Road", "Station Road", "Ring Road", "University Road"])}, ${city}`,
      pinCode: String(randomInt(380001, 395010)),
      contactPerson: `${firstName} ${lastName}`,
      mobile: `9${String(100000000 + index).padStart(9, "0").slice(-9)}`,
      email: `seed.customer.${Date.now()}.${index}@example.com`,
      gstNumber: "",
      referralSource: randomItem(referralSources),
      totalAmount,
      paymentMode: makePayments(totalAmount, index),
      products: selectedProducts.map((product) => product._id),
      attachments: {
        customerID: "",
        paymentSlip: "",
        inventoryPics: [],
        googleReview: "",
      },
      customFields: [
        { key: "seedData", value: "true" },
        { key: "seedRun", value: runId },
      ],
    };
  });
};

const main = async () => {
  const count = parseCount();

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const [branches, products, salesPeople] = await Promise.all([
    Branch.find({ status: { $ne: "inactive" } }).select("_id name").lean(),
    Product.find({ status: { $ne: "inactive" } }).select("_id name price srp supportedAmount").lean(),
    User.find({ role: "sales_person", status: "active" }).select("_id firstName lastName").lean(),
  ]);

  const users = salesPeople.length
    ? salesPeople
    : await User.find({ role: "admin", status: "active" }).select("_id firstName lastName").lean();

  if (!branches.length) throw new Error("No active branches found. Create a branch before seeding billings.");
  if (!products.length) throw new Error("No active products found. Create products before seeding billings.");
  if (!users.length) throw new Error("No active salesperson or admin user found.");

  const billings = buildBillings({ count, branches, products, users });

  if (process.argv.includes("--dry-run")) {
    console.log(`Dry run successful: ${billings.length} billing documents are ready to insert.`);
    return;
  }

  const inserted = await Billing.insertMany(billings, { ordered: true });
  console.log(`Inserted ${inserted.length} billing documents successfully.`);
  console.log(`First billing ID: ${inserted[0]._id}`);
  console.log('Seeded records are tagged with customFields.seedData = "true".');
};

main()
  .catch((error) => {
    console.error(`Billing seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

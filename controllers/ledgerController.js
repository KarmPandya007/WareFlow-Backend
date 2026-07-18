import Ledger from "../models/ledger.js";
import {
  createTallyLedgerXML,
  sendXMLtoTally
} from "../services/tallyService.js";

/**
 * Create Ledger in MongoDB only
 */
export const createLedger = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      gstNo,
      address,
      pincode,
      panCard,
      state,
      country,
      ledgerGroup,
      gstRegistrationType
    } = req.body;

    if (!name || !phone || !email || !address || !pincode || !state || !country) {
      return res.status(400).json({
        message: "Required fields: name, phone, email, address, pincode, state, country"
      });
    }
    
if (gstNo && gstNo.trim() !== "" && (!panCard || panCard.trim() === "")) {
  return res.status(400).json({
    success: false,
    message: "PAN is required when GST number is provided"
  });
}


    // Prevent duplicate ledger names (CRITICAL for Tally)
    const nameCheck = await Ledger.findOne({ name });
    if (nameCheck) {
      return res.status(400).json({
        message: "Ledger with this name already exists"
      });
    }

    // Optional unique checks
    if (email) {
      const emailCheck = await Ledger.findOne({ email });
      if (emailCheck) {
        return res.status(400).json({
          message: "Ledger with this email already exists"
        });
      }
    }

    if (gstNo) {
      const gstCheck = await Ledger.findOne({ gstNo });
      if (gstCheck) {
        return res.status(400).json({
          message: "Ledger with this GST number already exists"
        });
      }
    }

    if (panCard) {
      const panCheck = await Ledger.findOne({ panCard });
      if (panCheck) {
        return res.status(400).json({
          message: "Ledger with this PAN card already exists"
        });
      }
    }

    const ledger = await Ledger.create({
      name,
      phone,
      email,
      gstNo,
      address,
      pincode,
      panCard,
      state,
      country,
      ledgerGroup: ledgerGroup || "Sundry Debtors",
      gstRegistrationType: gstRegistrationType || "Unregistered"
    });

    res.status(201).json({
      success: true,
      message: "Ledger created in database",
      data: ledger
    });

  } catch (error) {
    console.error("Create Ledger Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Export existing Ledger to Tally
 */
export const tallyLedger = async (req, res) => {
  try {
    const { ledgerId } = req.params;

    // Fetch existing ledger
    const ledger = await Ledger.findById(ledgerId);
    if (!ledger) {
      return res.status(404).json({
        message: "Ledger not found"
      });
    }

    // Generate XML
    const xml = createTallyLedgerXML(ledger);

    // Send to Tally
    const tallyResponse = await sendXMLtoTally(xml);

    // Validate Tally response
    if (!tallyResponse.includes("<CREATED>1</CREATED>")) {
      return res.status(400).json({
        success: false,
        message: "Tally rejected the ledger",
        tallyResponse
      });
    }

    res.status(200).json({
      success: true,
      message: "Ledger exported to Tally successfully",
      tallyResponse
    });

  } catch (error) {
    console.error("Tally Ledger Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export ledger to Tally",
      error: error.message
    });
  }
};

/**
 * Get all ledgers
 */
export const getAllLedgers = async (req, res) => {
  try {
    const ledgers = await Ledger.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ledgers,
      count: ledgers.length
    });

  } catch (error) {
    console.error("Get All Ledgers Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete all ledgers (USE CAREFULLY)
 */
export const deleteAllLedgers = async (req, res) => {
  try {
    const result = await Ledger.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} ledgers`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("Delete All Ledgers Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


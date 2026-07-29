import AdvanceBooking from "../models/advanceBooking.js";

export const getAllBookings = async (req, res) => {
  try {
    const { status, branch, salesPerson, fromDate, toDate, page, limit } = req.query;
    let filter = {};

    // Sales person can only see their own bookings, admin sees all
    if (req.user.role === "sales_person") {
      filter.salesPerson = req.user.id;
    }

    if (status) filter.status = status;
    if (branch) filter.branch = branch;
    if (salesPerson && req.user.role === "admin") filter.salesPerson = salesPerson;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const totalCount = await AdvanceBooking.countDocuments(filter);

    let query = AdvanceBooking.find(filter)
      .populate("branch", "name code")
      .populate("salesPerson", "firstName lastName")
      .populate("products", "name model serialNumber supportedAmount category")
      .sort({ createdAt: -1 });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum && limitNum) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const bookings = await query.lean();

    const payload = {
      success: true,
      count: totalCount,
      bookings
    };

    if (pageNum && limitNum) {
      payload.totalPages = Math.ceil(totalCount / limitNum);
      payload.currentPage = pageNum;
    }

    res.json(payload);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch advance bookings", error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await AdvanceBooking.findById(req.params.id)
      .populate("branch", "name code")
      .populate("salesPerson", "firstName lastName")
      .populate("products", "name model serialNumber price category");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch booking", error: error.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    const {
      companyName,
      branch,
      salesPerson,
      date,
      salesType,
      customerName,
      address,
      pinCode,
      contactPerson,
      mobile,
      phone,
      email,
      gstNumber,
      referralSource,
      referralSourceOther,
      products,
      totalAmount,
      advanceAmount,
      paymentMode,
      deliveryDate,
      deliveryAddress,
      notes,
      attachments,
      customFields,
    } = req.body;

    if (!customerName || !mobile || !products || !totalAmount || !advanceAmount || !deliveryDate || !branch) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (advanceAmount > totalAmount) {
      return res.status(400).json({ success: false, message: "Advance amount cannot be greater than total amount" });
    }

    const paymentTotal = paymentMode.reduce((sum, pm) => sum + (pm.amount || 0), 0);
    if (Math.abs(paymentTotal - advanceAmount) > 0.01) {
      return res.status(400).json({ success: false, message: "Payment mode amounts must equal advance amount" });
    }

    const booking = new AdvanceBooking({
      companyName,
      branch,
      salesPerson: salesPerson || req.user?.id,
      date,
      salesType,
      customerName,
      address,
      pinCode,
      contactPerson,
      mobile,
      phone,
      email,
      gstNumber,
      referralSource,
      referralSourceOther,
      products,
      totalAmount,
      advanceAmount,
      paymentMode,
      deliveryDate,
      deliveryAddress,
      notes,
      attachments,
      customFields,
      createdBy: req.user?.id,
    });

    await booking.save();
    await booking.populate("branch", "name code");
    await booking.populate("salesPerson", "firstName lastName");
    await booking.populate("products", "name model serialNumber price category");

    res.status(201).json({ success: true, message: "Advance booking created successfully", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create booking", error: error.message });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const booking = await AdvanceBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ succes : false, message : "Booking not found" });
    }

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        booking[key] = req.body[key];
      }
    });

    if (req.body.totalAmount || req.body.advanceAmount) {
      booking.remainingAmount = booking.totalAmount - booking.advanceAmount;
    }

    booking.updatedBy = req.user?.id;
    await booking.save();
    await booking.populate("branch", "name code");
    await booking.populate("salesPerson", "firstName lastName");
    await booking.populate("products", "name model serialNumber price category");

    res.json({ success: true, message: "Booking updated successfully", booking });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update booking", error: error.message });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const booking = await AdvanceBooking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    await booking.deleteOne();
    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete booking", error: error.message });
  }
};

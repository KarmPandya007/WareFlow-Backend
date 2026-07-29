
import User from "../models/User.js";
import Branch from "../models/branch.js";

export const getAllSalesPersons = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Only admin can view salespersons." });
    }


    const salesPersons = await User.find({ role: "sales_person" })
      .populate("branches", "name code")
      .select("-pin")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = salesPersons.map((person, index) => ({
      no: index + 1,
      employeeId: person.employmentId || "N/A",
      name: `${person.firstName || ""} ${person.lastName || ""}`.trim(),
      user: person.role,
      branches: Array.isArray(person.branches) && person.branches.length > 0
        ? person.branches.map(b => b ? { id: b._id, name: b.name, code: b.code } : null)
        : [],
      contactNo: person.phone,
      status: person.status || "Active",
      email: person.email || "N/A",
      id: person._id,
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      salesPersons: formatted,
    });
  } catch (error) {
    console.error("Get all salespersons error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const updateSalesPerson = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only admin can update salesperson." 
      });
    }

    const { id } = req.params;
    const { firstName, lastName, phone, email, branches, status, employmentId } = req.body;

    const salesPerson = await User.findOne({ _id: id, role: "sales_person" });
    if (!salesPerson) {
      return res.status(404).json({ success: false, message: "Salesperson not found" });
    }

    if (firstName !== undefined) salesPerson.firstName = firstName;
    if (lastName !== undefined) salesPerson.lastName = lastName;
    if (phone !== undefined) salesPerson.phone = phone;
    if (email !== undefined) salesPerson.email = email;
    if (branches !== undefined) salesPerson.branches = branches;
    if (status !== undefined) salesPerson.status = status;
    if (employmentId !== undefined) salesPerson.employmentId = employmentId;

    await salesPerson.save({ validateBeforeSave: true });

    const updated = await User.findById(id)
      .populate("branches", "name code")
      .select("-pin");

    res.status(200).json({
      success: true,
      message: "Salesperson updated successfully",
      salesPerson: updated,
    });
  } catch (error) {
    console.error("Update salesperson error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Server error",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const deleteSalesPerson = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Only admin can delete salesperson." });
    }

    const { id } = req.params;
    const deleted = await User.findOneAndDelete({ _id: id, role: "sales_person" });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Salesperson not found" });
    }

    res.status(200).json({
      success: true,
      message: "Salesperson deleted successfully",
    });
  } catch (error) {
    console.error("Delete salesperson error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

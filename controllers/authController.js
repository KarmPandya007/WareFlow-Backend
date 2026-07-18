import User from "../models/User.js";
import Branch from "../models/branch.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
 import { sendCredentialsEmail } from "../services/emailService.js";


// Generate JWT Token
const generateToken = (userId) => {
  const expires = process.env.JWT_EXPIRE || "1d"; 
  console.log("JWT expiresIn:", expires);
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: expires,
  });
};

export const registerUser = async (req, res) => {
  try {
    console.log("Register request body:", req.body);
    const { firstName, lastName, phone, pin, role, branches, employmentId, email } = req.body;

    // Validate required fields
    if (!firstName || !phone || !pin || !role) {
      console.log("❌ Missing required fields:", { firstName: !!firstName, phone: !!phone, pin: !!pin, role: !!role });
      return res.status(400).json({ 
        success: false, 
        message: "First name, phone, pin, and role are required" 
      });
    }

    // Validate PIN format (must be exactly 6 digits)
    if (!/^\d{6}$/.test(pin)) {
      console.log("❌ Invalid PIN format:", pin);
      return res.status(400).json({ 
        success: false, 
        message: "PIN must be exactly 6 digits" 
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Only admin can create users" 
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "Phone number already exists" 
      });
    }

    // Check for existing employment ID for sales persons
    if (role === "sales_person" && employmentId) {
      const existingEmpId = await User.findOne({ employmentId });
      if (existingEmpId) {
        return res.status(400).json({ 
          success: false, 
          message: "Employment ID already exists" 
        });
      }
    }

    if (role === "sales_person") {
      if (!Array.isArray(branches) || branches.length === 0 || !employmentId || !pin) {
        return res.status(400).json({ 
          success: false, 
          message: "branches (array), Employment ID, and PIN are required for sales person" 
        });
      }
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: "Email is required for sales person" 
        });
      }
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false, 
          message: "Please provide a valid email address" 
        });
      }
      // Validate all branch IDs exist
      const foundBranches = await Branch.find({ _id: { $in: branches } });
      if (foundBranches.length !== branches.length) {
        return res.status(400).json({ 
          success: false, 
          message: "One or more branches do not exist. Please check branch IDs." 
        });
      }
      // Create user
      const user = await User.create({
        firstName,
        lastName,
        phone,
        pin,
        role,
        email,
        branches,
        employmentId: employmentId || null,
      });
      // Respond immediately
      res.status(201).json({ 
        success: true,
        message: "Sales person registered successfully. Credentials will be sent via email.", 
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
          role: user.role,
          branches: foundBranches.map(b => ({ id: b._id, name: b.name })),
          employmentId: user.employmentId
        }
      });
      console.log("Sales person registered successfully. Credentials will be sent via email.")
      // Send email asynchronously
      setImmediate(async () => {
        try {
          console.log('Sending credentials email to:', email);
          const emailResult = await sendCredentialsEmail(
            email,
            firstName,
            phone,
            pin,
            foundBranches.map(b => b.name).join(', ')
          );
          if (emailResult.success) {
            console.log('Email sent successfully to:', email);
          } else {
            console.error('Email sending failed:', emailResult.error);
          }
        } catch (error) {
          console.error('Error sending email:', error);
        }
      });
      return; // Prevents falling through to admin logic
    }

    // For non-sales person roles (admin)
    const user = await User.create({
      firstName,
      lastName,
      phone,
      pin,
      role,
      email: email || null,
      employmentId: employmentId || null,
    });

    res.status(201).json({ 
      success: true, 
      message: "User registered successfully", 
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("❌ Register user error:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      success: false,
      message: error.message || "Server Error", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


export const login = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    
    const user = await User.findOne({ phone, status: "active" })
      .select('_id firstName lastName role branch pin')
      .lean();
    
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid PIN" });
    }

    const token = generateToken(user._id);
    
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(200).json({
      success: true,
      token,
      message: "Login successful",
      user: { 
        id: user._id, 
        firstName: user.firstName, 
        lastName: user.lastName,
        role: user.role, 
        branch: user.branch 
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error while logging in" });
  }
};

export const logout = async (req, res) => {
  try {
    
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error while logging out" });
  }
};

import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/token.js";
import { EmailService } from "../lib/emailService.js";

export const signUp = async (req, res) => {
  try {
    const { fullName, email, password, mobile, role } = req.body;

    if (!fullName || !email || !password || !mobile || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Password must be at least 6 characters",
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    if (!passwordHash) {
      return res
        .status(500)
        .json({ success: false, message: "Error in password hashing" });
    }

    if (!mobile.match(/^[0-9]{10}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid mobile number" });
    }

    const user = await User.create({
      fullName,
      email,
      password: passwordHash,
      mobile,
      role,
    });

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Auto-detect based on environment
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
    });

    // Send welcome email using BullMQ (non-blocking)
    EmailService.sendWelcomeEmail(email).catch((err) => {
      console.error("Failed to queue welcome email:", err);
    });

    return res
      .status(201)
      .json({ success: true, message: "User created successfully", user });
  } catch (error) {
    console.error(error.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Password" });
    }

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Auto-detect based on environment
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
    });

    return res
      .status(200)
      .json({
        success: true,
        message: "User signed in successfully",
        user,
        token,
      });
  } catch (error) {
    console.error(error.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const signOut = async (req, res) => {
  try {
    console.log("SignOut called - Current cookies:", req.cookies);

    // Method 1: Clear with exact same options
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });

    // Method 2: Alternative clearing (backup)
    res.cookie("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 0, // Expire immediately
      path: "/",
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
    });

    console.log("Token cookie cleared successfully");
    return res
      .status(200)
      .json({ success: true, message: "User signed out successfully" });
  } catch (error) {
    console.error(error.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.otp = otp;
    user.isOtpExpired = Date.now() + 5 * 60 * 1000; // 5 minutes
    user.isOtpVerified = false;
    await user.save();

    // Add email job to BullMQ queue
    const emailResult = await EmailService.sendPasswordResetEmail(email, otp);

    if (emailResult.success) {
      return res.status(200).json({
        success: true,
        message: "OTP sent to email",
        jobId: emailResult.jobId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to queue email: " + emailResult.message,
      });
    }
  } catch (error) {
    console.error(error.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (user.isOtpExpired < Date.now()) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    user.otp = undefined;
    user.isOtpExpired = undefined;
    user.isOtpVerified = true;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error(error.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error(error.message || error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { email, fullName, mobile, role } = req.body;
    let existingUser = await User.findOne({ email });

    if (!existingUser) {
      existingUser = await User.create({ fullName, email, mobile, role });
    }
    const token = await generateToken(existingUser);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
    });

    return res
      .status(200)
      .json({
        success: true,
        message: "User signed in successfully",
        user: existingUser,
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error" + error.message,
      });
  }
};

import express from "express";
import { EmailService } from "../lib/emailService.js";

const router = express.Router();

// Get queue statistics
router.get("/stats", async (req, res) => {
    try {
        const stats = await EmailService.getQueueStats();
        if (stats) {
            res.status(200).json({
                success: true,
                data: stats
            });
        } else {
            res.status(500).json({
                success: false,
                message: "Failed to get queue statistics"
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Clear failed jobs
router.post("/clear-failed", async (req, res) => {
    try {
        const result = await EmailService.clearFailedJobs();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Retry failed jobs
router.post("/retry-failed", async (req, res) => {
    try {
        const result = await EmailService.retryFailedJobs();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Test email (for development)
router.post("/test", async (req, res) => {
    try {
        const { email, type = 'password-reset', otp = '1234' } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        let result;
        switch (type) {
            case 'welcome':
                result = await EmailService.sendWelcomeEmail(email);
                break;
            case 'order-confirmation':
                result = await EmailService.sendOrderConfirmationEmail(email, otp);
                break;
            default:
                result = await EmailService.sendPasswordResetEmail(email, otp);
        }

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
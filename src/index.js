import dotenv from "dotenv";

// Load environment variables FIRST before any other imports
dotenv.config();

import express from "express";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import queueRouter from "./routes/queue.routes.js";
import shopRouter from "./routes/shop.route.js";
import itemRouter from "./routes/item.route.js";
import orderRouter from "./routes/order.route.js";
import razorpayRouter from "./routes/razorpay.routes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from 'url';
// Import email worker to start processing jobs
import "./lib/emailQueue.js";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:3001",
            "https://food-delivery-app-frontend-4.onrender.com",
            process.env.FRONTEND_URL, // Add your deployed frontend URL to .env
            // Add more domains as needed
        ].filter(Boolean); // Remove undefined values
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.use(express.json());
app.use(cookieParser()); // Add cookie parser middleware

// Request logging middleware for debugging
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
            origin: req.headers.origin,
            cookies: Object.keys(req.cookies),
            hasAuth: !!req.cookies.token
        });
    }
    next();
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        cors: {
            allowedOrigins: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, "http://localhost:5173"] : ["http://localhost:5173"]
        }
    });
});

// CORS debug endpoint (remove in production)
app.get('/cors-test', (req, res) => {
    res.status(200).json({
        success: true,
        origin: req.headers.origin,
        cookies: req.cookies,
        headers: {
            'user-agent': req.headers['user-agent'],
            'referer': req.headers.referer
        }
    });
});

app.use("/api/auth", authRouter);
app.use('/api/user', userRouter);
app.use('/api/queue', queueRouter);
app.use("/api/shop",shopRouter)
app.use("/api/item",itemRouter)
app.use("/api/order",orderRouter)
app.use("/api/razorpay", razorpayRouter);

app.listen(PORT, () => {
    connectDB();
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`📧 Email worker started - processing jobs from Redis queue`);
});
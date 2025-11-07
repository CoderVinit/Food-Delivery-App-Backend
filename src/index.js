import dotenv from "dotenv";

dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import queueRouter from "./routes/queue.routes.js";
import shopRouter from "./routes/shop.route.js";
import itemRouter from "./routes/item.route.js";
import orderRouter from "./routes/order.route.js";
import razorpayRouter from "./routes/razorpay.routes.js";
import { initSocketServer } from "./socket/socket.js";
import "./lib/emailQueue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5174",
    "https://food-delivery-app-frontend-4.onrender.com",
    process.env.FRONTEND_URL
].filter(Boolean);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        console.log("CORS origin:", origin);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        const msg = "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
            origin: req.headers.origin,
            cookies: Object.keys(req.cookies || {}),
            hasAuth: !!req.cookies?.token
        });
    }
    next();
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/public", express.static(path.join(__dirname, "../public")));

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is running",
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        cors: {
            allowedOrigins: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, "http://localhost:5173"] : ["http://localhost:5173"]
        }
    });
});

app.get("/cors-test", (req, res) => {
    res.status(200).json({
        success: true,
        origin: req.headers.origin,
        cookies: req.cookies,
        headers: {
            "user-agent": req.headers["user-agent"],
            referer: req.headers.referer
        }
    });
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/queue", queueRouter);
app.use("/api/shop", shopRouter);
app.use("/api/item", itemRouter);
app.use("/api/order", orderRouter);
app.use("/api/razorpay", razorpayRouter);

initSocketServer(server, allowedOrigins);

const startServer = async () => {
    await connectDB();
    server.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log("📧 Email worker started - processing jobs from Redis queue");
    });
};

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
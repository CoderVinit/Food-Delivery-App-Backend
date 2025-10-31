
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { CreateOrder, VerifyPayment } from '../controllers/razorpay.controller.js';


const router = express.Router();




router.post('/create-order', authMiddleware, CreateOrder);

router.post('/verify-payment', authMiddleware, VerifyPayment);

export default router;
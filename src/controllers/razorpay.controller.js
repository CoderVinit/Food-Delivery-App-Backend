import Razorpay from "razorpay";
import crypto from "crypto";

export const CreateOrder = async (req, res) => {
  try {
    const { amount, receipt, notes } = req.body;

    // Validate amount (expect rupees). Razorpay needs amount in paise.
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!numericAmount || isNaN(numericAmount) || Number(numericAmount) <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }


    // Convert amount (rupees) to paise as required by Razorpay
    const amountInPaise = Math.round(Number(numericAmount) * 100);

    // Initialize Razorpay lazily to avoid crashing server if not configured
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY;
    if (!keyId || !keySecret) {
      return res.status(500).json({
        success: false,
        message: "Payment gateway not configured",
        hint: "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment",
      });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt || `receipt_order_${Date.now()}`,
      notes: {
        ...(notes || {}),
        userId: req.userId || undefined,
      },
    };

    const order = await razorpay.orders.create(options);

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error?.response?.data || error?.message || error);
    const description = error?.response?.data?.error?.description || error?.message || "Failed to create payment order";
    const status = error?.status || error?.response?.status || 500;
    res.status(status).json({
      success: false,
      message: description,
    });
  }
};

export const VerifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY;
    if (!keySecret) {
      return res.status(500).json({ success: false, message: "Payment gateway secret not configured" });
    }
    const generated_signature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature, payment verification failed",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: { razorpay_order_id, razorpay_payment_id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

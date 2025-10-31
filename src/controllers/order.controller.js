import EmailService from "../lib/emailService.js";
import { sendMail } from "../lib/sendMail.js";
import DeliveryAssignment from "../models/deliveryAssignment.model.js";
import Order from "../models/order.model.js";
import Shop from "../models/shop.model.js";
import User from "../models/user.model.js";
import crypto from "crypto";

export const placeOrder = async (req, res) => {
  try {
    const { cartItems, paymentMethod, deliveryAddress, totalAmount, payment } = req.body;
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
    if (
      !deliveryAddress ||
      !deliveryAddress.text ||
      !deliveryAddress.latitude ||
      !deliveryAddress.longitude
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Delivery address is required" });
    }

    const groupItemsByShop = {};

    // Normalize and group items by shop id (supports shop as id or populated object)
    cartItems.forEach((item) => {
      const shopId = typeof item.shop === "string" ? item.shop : (item.shop?._id || item.shop);
      if (!shopId) {
        throw new Error("Invalid cart item: missing shop id");
      }
      const key = shopId.toString();
      if (!groupItemsByShop[key]) {
        groupItemsByShop[key] = [];
      }
      groupItemsByShop[key].push(item);
    });

    const shopOrder = await Promise.all(
      Object.keys(groupItemsByShop).map(async (shopId) => {
        const shop = await Shop.findById(shopId).populate("owner");
        console.log(shop);
        if (!shop) {
          throw new Error("Shop not found");
        }
        const items = groupItemsByShop[shopId];
        console.log(items);
        const subTotal = items.reduce(
          (acc, item) => acc + Number(item.price) * Number(item.quantity),
          0
        );

        return {
          shop: shop._id,
          owner: shop.owner._id,
          subtotal: subTotal,
          shopOrderItems: items.map((i) => ({
            // Support i.id or i._id in payload
            item: i.id || i._id,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            image: i.image,
            foodType: i.foodType,
          })),
        };
      })
    );

    // Prepare payment details
    let paymentStatus = "pending";
    let paymentDetails = undefined;

    if (paymentMethod === "online") {
      // Validate razorpay payment details and signature
      const reqOrderId = payment?.orderId || payment?.razorpay_order_id;
      const reqPaymentId = payment?.paymentId || payment?.razorpay_payment_id;
      const reqSignature = payment?.signature || payment?.razorpay_signature;
      if (!reqOrderId || !reqPaymentId || !reqSignature) {
        return res.status(400).json({
          success: false,
          message: "Payment details are required for online payments",
        });
      }
      const secret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET_KEY;
      if (!secret) {
        return res.status(500).json({ success: false, message: "Payment configuration missing" });
      }
      const hmac = crypto
        .createHmac("sha256", secret)
        .update(`${reqOrderId}|${reqPaymentId}`)
        .digest("hex");
      if (hmac !== reqSignature) {
        return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }

      paymentStatus = "paid";
      paymentDetails = {
        provider: payment?.provider || "razorpay",
        orderId: reqOrderId,
        paymentId: reqPaymentId,
        signature: reqSignature,
        currency: payment?.currency || "INR",
        amount: payment?.amount, // expected paise
        receipt: payment?.receipt,
      };
    }

    const newOrder = await Order.create({
      userId: req.userId,
      paymentMethod,
      paymentStatus,
      payment: paymentDetails,
      deliveryAddress,
      totalAmount,
      shopOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate("shopOrder.shop", "name")
      .populate("shopOrder.owner", "fullName email mobile")
      .populate("shopOrder.shopOrderItems.item");
    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getOwnerOrders = async (req, res) => {
  try {
    const ownerId = req.userId;
    // Find orders that contain at least one shopOrder for this owner and populate related refs
    let orders = await Order.find({ "shopOrder.owner": ownerId })
      .sort({ createdAt: -1 })
      .populate("userId")
      .populate("shopOrder.shop", "name")
      .populate("shopOrder.owner", "fullName email mobile")
      .populate("shopOrder.shopOrderItems.item", "name price image quantity")
      .populate("shopOrder.assignedDeliveryBoy", "fullName email mobile");

    // Filter each order's shopOrder array to only include entries belonging to this owner
    orders = orders.map((order) => {
      const filteredShopOrder = order.shopOrder.filter((so) => {
        const id = so.owner && so.owner._id ? so.owner._id : so.owner;
        return id?.toString() === ownerId.toString();
      });
      const totalAmount = filteredShopOrder.reduce((acc, so) => {
        return acc + so.subtotal;
      }, 0);
      return {
        ...order.toObject(),
        totalAmount: totalAmount < 500 ? totalAmount + 50 : totalAmount,
        shopOrder: filteredShopOrder,
      };
    });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, shopOrderId } = req.params;
    const { status } = req.body;
    console.log(status)
    if (!orderId || !shopOrderId || !status) {
      return res.status(400).json({
        success: false,
        message: "orderId, shopOrderId and status are required",
      });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    let shopOrder = order.shopOrder.find(
      (so) => so._id.toString() === shopOrderId
    );

    if (!shopOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Shop order not found" });
    }
    shopOrder.status = status;

    let deliveryBoyPayload = [];
    if (status === "out-for-delivery" && !shopOrder.assignment) {
      const { longitude, latitude } = order.deliveryAddress;
      // Assign delivery person logic here
      // Try 5km first
      let nearestDeliveryPerson = await User.find({
        role: "deliveryBoy",
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [longitude, latitude] },
            $maxDistance: 5000,
          },
        },
      });
      // Fallback to 20km radius if none found
      if (!nearestDeliveryPerson || nearestDeliveryPerson.length === 0) {
        nearestDeliveryPerson = await User.find({
          role: "deliveryBoy",
          location: {
            $near: {
              $geometry: { type: "Point", coordinates: [longitude, latitude] },
              $maxDistance: 20000,
            },
          },
        });
      }
      console.log("Nearest delivery persons:", nearestDeliveryPerson);
      const nearByIds = nearestDeliveryPerson.map((person) => person._id);
      // Find delivery boys who are currently busy (only those with active assignments)
      const busyDeliveryBoys = await DeliveryAssignment.find({
        assignedTo: { $in: nearByIds },
        status: { $in: ["assigned", "picked-up", "en-route"] }, // Active assignments only
      }).distinct("assignedTo");
      const busySet = new Set(busyDeliveryBoys.map((id) => id.toString()));

      // Available delivery boys are those who are not currently assigned to any active delivery
      const availableBoys = nearestDeliveryPerson.filter(
        (person) => !busySet.has(person._id.toString())
      );
      const candidates = availableBoys.map((b) => b._id);

      const deliveryAssignment = await DeliveryAssignment.create({
        order: order._id,
        shop: shopOrder.shop,
        shopOrderId: shopOrder._id,
        broadcastedTo: candidates,
      });

      shopOrder.assignment = deliveryAssignment._id;
      shopOrder.assignedDeliveryBoy = deliveryAssignment.assignedTo;

      deliveryBoyPayload = availableBoys.map((b) => ({
        id: b._id,
        name: b.fullName,
        email: b.email,
        phone: b.mobile,
        latitude: b.location.coordinates[1],
        longitude: b.location.coordinates[0],
      }));
    }
    console.log(deliveryBoyPayload);
    await order.populate("shopOrder.shopOrderItems.item", "name image price");
    await order.populate("shopOrder.shop", "name address");
    await order.populate(
      "shopOrder.assignedDeliveryBoy",
      "fullName email mobile"
    );
    await order.populate("userId", "fullName email");
    await order.save();
    if (status === "preparing") {
      EmailService.sendOrderStatusUpdateEmail(
        order.userId?.email,
        shopOrder.status
      );
    }

    const updatedShopOrder = order.shopOrder.find((o) => o._id == shopOrderId);

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        shopOrder: updatedShopOrder,
        assignedDeliveryBoy: updatedShopOrder?.assignedDeliveryBoy,
        availableDeliveryBoys: deliveryBoyPayload,
        assignment: updatedShopOrder?.assignment,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAssignmentsOfDeliveryBoy = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;
    const assignments = await DeliveryAssignment.find({
      broadcastedTo: deliveryBoyId,
      status: "broadcasted",
    })
      .populate("order")
      .populate("shop");

    const formated = assignments.map((o) => ({
      assignmentId: o._id,
      orderId: o.order._id,
      shopName: o.shop.name,
      items:
        o.order.shopOrder.find(
          (so) => so._id.toString() === o.shopOrderId.toString()
        )?.shopOrderItems || [],
      subtotal: o.order.totalAmount,
      deliveryAddress: o.order.deliveryAddress,
    }));

    return res.status(200).json({ success: true, data: formated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const acceptOrder = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;
    const { assignmentId } = req.params;
    if (!assignmentId) {
      return res
        .status(400)
        .json({ success: false, message: "assignmentId is required" });
    }
    const assignment = await DeliveryAssignment.findById(assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }
    if (assignment.status !== "broadcasted") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Assignment is not in broadcasted state",
        });
    }

    if (
      !assignment.broadcastedTo
        .map((id) => id.toString())
        .includes(deliveryBoyId.toString())
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You are not authorized to accept this assignment",
        });
    }

    assignment.status = "assigned";
    assignment.assignedTo = deliveryBoyId;
    assignment.acceptedAt = new Date();
    assignment.broadcastedTo = []; // Clear broadcastedTo list
    await assignment.save();

    const order = await Order.findById(assignment.order);
    const shopOrder = order.shopOrder.find(
      (so) => so._id.toString() === assignment.shopOrderId.toString()
    );
    shopOrder.assignedDeliveryBoy = deliveryBoyId;
    await order.save();

    return res
      .status(200)
      .json({
        success: true,
        message: "Order accepted successfully",
        data: { assignmentId: assignment._id, orderId: order._id },
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const currentOrder = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;

    const assignment = await DeliveryAssignment.findOne({
      assignedTo: deliveryBoyId,
      status: "assigned",
    })
      .populate("shop", "name")
      .populate("assignedTo", "fullName email mobile location")
      .populate({
        path: "order",
        populate: [
          { path: "userId", select: "fullName email mobile location" },
        ],
      });

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "No current assignment found" });
    }

    if (!assignment.order) {
      return res
        .status(404)
        .json({ success: false, message: "Order details not found" });
    }

    const shopOrder = assignment.order.shopOrder.find(
      (so) => so._id.toString() === assignment.shopOrderId.toString()
    )
    if (!shopOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Shop order details not found" });
    }

    let deliveryBoyLocation = { lat: null, long: null };
    if (
      assignment.assignedTo.location &&
      assignment.assignedTo.location.coordinates
    ) {
      deliveryBoyLocation.lat = assignment.assignedTo.location.coordinates[1];
      deliveryBoyLocation.long = assignment.assignedTo.location.coordinates[0];
    }
    const customerLocation = { lat: null, long: null };
    if (assignment.order.deliveryAddress) {
      customerLocation.lat = assignment.order.deliveryAddress.latitude;
      customerLocation.long = assignment.order.deliveryAddress.longitude;
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: assignment._id,
        user: assignment.order.userId,
        shop: assignment.shop,
        shopOrder,
        deliveryAddress: assignment.order.deliveryAddress,
        deliveryBoyLocation,
        customerLocation,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const markOrderAsDelivered = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;
    const assignments = await DeliveryAssignment.findOne({
      assignedTo: deliveryBoyId,
      status: "assigned", // Ensure the assignment is still active
    })
    .populate("order")
    .populate("shop")
    .populate({
      path: "order",
      populate: [
        { path: "userId", select: "fullName email mobile location" },
        { path: "shopOrder.shop", select: "name location" },
      ],
    });

    if (!assignments) {
      return res
        .status(404)
        .json({ success: false, message: "No current assignment found" });
    }
    const user = await User.findById(assignments.order.userId._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    user.otp = otp;
    user.isOtpExpired = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes
    await user.save();


    await EmailService.sendOrderDeliveredEmail(
      assignments.order.userId.email,
      otp
    );
    res.status(200).json({success:true,message:"Otp sent successfully"});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}


export const getOrderById = async(req,res)=>{
  try {
    const {orderId}=req.params;
    if(!orderId){
      return res.status(400).json({success:false,message:"orderId is required"});
    }

    const order=await Order.findById(orderId)
    .populate("userId")
    .populate({
      path:"shopOrder.shop",
      model:"Shop"
    })
    .populate({
      path:"shopOrder.assignedDeliveryBoy",
      model:"User"
    })
    .populate({
      path:"shopOrder.shopOrderItems.item",
      model:"Item"
    })
    .lean()
    if(!order){
      return res.status(404).json({success:false,message:"Order not found"});
    }

    return res.status(200).json({success:true,data:order});

  } catch (error) {
    console.error(error);
    res.status(500).json({success:false,message:"Internal server error"});
  }
}


export const orderDelivered = async(req,res)=>{
  try {
    const {otp}=req.body;
    const deliveryBoyId = req.userId;

    const assignment = await DeliveryAssignment.findOne({
      assignedTo: deliveryBoyId,
      status: "assigned",
    }).populate("order")
    .populate({
      path: "order",
      populate: [
        { path: "userId", select: "fullName email mobile location" },
      ],
    });

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "No current assignment found" });
    } 

    const user = await User.findById(assignment.order.userId._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if(user.isOtpExpired < Date.now()){
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }
    // Mark assignment as completed and free the delivery person
    // When status is "completed", the delivery boy becomes available for new assignments
    assignment.status = "completed";
    assignment.completedAt = new Date();
    assignment.assignedTo = null;
    // Keep assignedTo for historical record, but delivery boy is now free since status = "completed"
    
    await assignment.save();
    const order = await Order.findById(assignment.order._id);
    const shopOrder = order.shopOrder.find(
      (so) => so._id.toString() === assignment.shopOrderId.toString()
    );
    shopOrder.status = "delivered";
    // Clear the assigned delivery boy from the shop order since delivery is completed
    shopOrder.assignedDeliveryBoy = null;
    await order.save();
    user.otp = undefined;
    user.isOtpExpired = undefined;
    await user.save();

    return res.status(200).json({success:true,message:"Order marked as delivered successfully"});
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
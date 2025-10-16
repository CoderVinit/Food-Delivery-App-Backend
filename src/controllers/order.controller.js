import EmailService from "../lib/emailService.js";
import DeliveryAssignment from "../models/deliveryAssignment.model.js";
import Order from "../models/order.model.js";
import Shop from "../models/shop.model.js";
import User from "../models/user.model.js";

export const placeOrder = async (req, res) => {
  try {
    const { cartItems, paymentMethod, deliveryAddress, totalAmount } = req.body;
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

    cartItems.forEach((item) => {
      const shopId = item.shop;
      if (!groupItemsByShop[shopId]) {
        groupItemsByShop[shopId] = [];
      }
      groupItemsByShop[shopId].push(item);
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
            item: i.id,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            image: i.image,
            foodType: i.foodType,
          })),
        };
      })
    );

    const newOrder = await Order.create({
      userId: req.userId,
      paymentMethod,
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
      .populate("shopOrder.assignedDeliveryBoy", "fullName email mobile")

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
      const nearestDeliveryPerson = await User.find({
        role: "deliveryBoy",
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [longitude, latitude] },
            $maxDistance: 5000,
          },
        },
      });
      console.log("Nearest delivery persons:", nearestDeliveryPerson);
      const nearByIds = nearestDeliveryPerson.map((person) => person._id);
      const busyDeliveryBoys = await DeliveryAssignment.find({
        assignedTo: { $in: nearByIds },
        status: { $nin: ["broadcasted", "completed"] },
      }).distinct("assignedTo");
      const busySet = new Set(busyDeliveryBoys.map((id) => id.toString()));

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
    console.log(deliveryBoyPayload)
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

    console.log(order.shopOrder);
    console.log("Shop order id:", shopOrderId);
    const updatedShopOrder = order.shopOrder.find((o) => o._id == shopOrderId);
    console.log("Updated shop order:", updatedShopOrder);

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data:{
        shopOrder: updatedShopOrder,
      assignedDeliveryBoy: updatedShopOrder?.assignedDeliveryBoy,
      availableDeliveryBoys: deliveryBoyPayload,
      assignment: updatedShopOrder?.assignment,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const getAssignmentsOfDeliveryBoy = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;
    const assignments = await DeliveryAssignment.find({broadcastedTo: deliveryBoyId, status: "broadcasted"}).populate("order")
    .populate("shop")


    const formated = assignments.map((o)=>({
      assignmentId: o._id,
      orderId: o.order._id,
      shopName: o.shop.name,
      items:o.order.shopOrder.find(so=>so._id.toString()===o.shopOrderId.toString())?.shopOrderItems || [],
      subtotal: o.order.totalAmount,
      deliveryAddress: o.order.deliveryAddress,
    }))

    return res.status(200).json({success: true, data: formated});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: "Internal server error"});
  }
}



export const acceptOrder = async(req, res) => {
  try {
    const deliveryBoyId = req.userId;
    const {assignmentId} = req.params;
    if(!assignmentId){
      return res.status(400).json({success: false, message: "assignmentId is required"});
    }
    const assignment = await DeliveryAssignment.findById(assignmentId);
    if(!assignment){
      return res.status(404).json({success: false, message: "Assignment not found"});
    }
    if(assignment.status !== "broadcasted"){
      return res.status(400).json({success: false, message: "Assignment is not in broadcasted state"});
    }

    if(!assignment.broadcastedTo.map(id=>id.toString()).includes(deliveryBoyId.toString())){
      return res.status(403).json({success: false, message: "You are not authorized to accept this assignment"});
    }



    assignment.status = "assigned";
    assignment.assignedTo = deliveryBoyId;
    assignment.acceptedAt = new Date();
    assignment.broadcastedTo = []; // Clear broadcastedTo list
    await assignment.save();

    const order = await Order.findById(assignment.order);
    const shopOrder = order.shopOrder.find(so=>so._id.toString()===assignment.shopOrderId.toString());
    shopOrder.assignedDeliveryBoy = deliveryBoyId;
    await order.save();


    return res.status(200).json({success: true, message: "Order accepted successfully", data:{assignmentId: assignment._id, orderId: order._id}});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: "Internal server error"});
  }
};
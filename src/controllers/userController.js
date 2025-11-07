import DeliveryAssignment from "../models/deliveryAssignment.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import { getIO } from "../socket/socket.js";


export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.status(200).json({ success: true, user });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}


export const updateUserLocation = async (req, res) => {
    try {
        const {lat,long} = req.body;
        const user = await User.findByIdAndUpdate(req.userId,{
            location:{
                type: "Point",
                coordinates: [long, lat] // Note: GeoJSON format is [longitude, latitude]
            }
        },{new:true});
        if(!user){
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const io = getIO();
        if (io && user.role === "deliveryBoy") {
            const assignment = await DeliveryAssignment.findOne({
                assignedTo: user._id,
                status: { $in: ["assigned", "picked-up", "en-route"] }
            }).lean();

            if (assignment) {
                const order = await Order.findById(assignment.order).select("userId shopOrder deliveryAddress").lean();
                if (order) {
                    const shopOrder = order.shopOrder?.find((so) => so._id.toString() === assignment.shopOrderId.toString());
                    const userId = order.userId?.toString();
                    const ownerId = shopOrder?.owner?.toString?.();
                    const payload = {
                        orderId: order._id.toString(),
                        shopOrderId: assignment.shopOrderId.toString(),
                        assignmentId: assignment._id.toString(),
                        deliveryBoyId: user._id.toString(),
                        location: { lat, long },
                        deliveryAddress: order.deliveryAddress
                    };

                    io.to(`order:${payload.orderId}`).emit("delivery:location", payload);
                    if (userId) {
                        io.to(`user:${userId}`).emit("delivery:location", payload);
                    }
                    if (ownerId) {
                        io.to(`owner:${ownerId}`).emit("delivery:location", payload);
                    }
                    io.to(`delivery:${payload.deliveryBoyId}`).emit("delivery:location", payload);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Location updated successfully",
            location: user.location
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}



export const availableDeliveryBoys = async(req, res) => {
    try {
        const {latitude, longitude} = req.query;
        console.log(latitude, longitude);
        if(!longitude || !latitude){
            return res.status(400).json({
                success: false,
                message: "Longitude and latitude are required"
            });
        }
        // Step 1: find nearby delivery boys within 5km; fallback to 20km if none
        let deliveryBoys = await User.find({
            role: "deliveryBoy",
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                    $maxDistance: 5000
                }
            }
        }).select("fullName email location mobile");
        if (!deliveryBoys || deliveryBoys.length === 0) {
            deliveryBoys = await User.find({
                role: "deliveryBoy",
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                        $maxDistance: 20000
                    }
                }
            }).select("fullName email location mobile");
        }

        // Build busy set: only assignments currently 'assigned' and with valid assignedTo
        const busyDeliveryBoys = new Set();
        const busyBoys = await DeliveryAssignment.find({ status: { $in: ["assigned", "picked-up", "en-route"] } }).select("assignedTo");
        busyBoys.forEach(assignment => {
            if (assignment.assignedTo) busyDeliveryBoys.add(assignment.assignedTo.toString());
        });

        const availableBoys = deliveryBoys.filter(boy => !busyDeliveryBoys.has(boy._id.toString()));

        res.status(200).json({
            success: true,
            data: availableBoys
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}


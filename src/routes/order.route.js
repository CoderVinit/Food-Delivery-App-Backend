import express from 'express'
import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';
import { acceptOrder, currentOrder, getAssignmentsOfDeliveryBoy, getMyOrders, getOrderById, getOwnerOrders, markOrderAsDelivered, orderDelivered, placeOrder, updateOrderStatus } from '../controllers/order.controller.js';


const router = express.Router();


router.post("/place-order", authMiddleware,authorizeRoles("user"), placeOrder);
router.get("/my-orders", authMiddleware,authorizeRoles("user"), getMyOrders);
router.get("/owner-orders", authMiddleware,authorizeRoles("owner"), getOwnerOrders);
router.put("/update-order-status/:orderId/:shopOrderId", authMiddleware,authorizeRoles("owner"), updateOrderStatus);
router.get("/get-assignment",authMiddleware,authorizeRoles("deliveryBoy"), getAssignmentsOfDeliveryBoy);
router.post("/accept-order/:assignmentId",authMiddleware,authorizeRoles("deliveryBoy"), acceptOrder);
router.get("/current-order", authMiddleware, authorizeRoles("deliveryBoy"), currentOrder);
router.get("/get-order-by-id/:orderId", authMiddleware, getOrderById);
router.post("/mark-order-as-delivered", authMiddleware, authorizeRoles("deliveryBoy"), markOrderAsDelivered);
router.post("/send-delivery-otp", authMiddleware, authorizeRoles("deliveryBoy"), orderDelivered);



export default router;
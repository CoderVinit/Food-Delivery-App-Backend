import express from 'express'
import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';
import { acceptOrder, getAssignmentsOfDeliveryBoy, getMyOrders, getOwnerOrders, placeOrder, updateOrderStatus } from '../controllers/order.controller.js';


const router = express.Router();


router.post("/place-order", authMiddleware,authorizeRoles("user"), placeOrder);
router.get("/my-orders", authMiddleware,authorizeRoles("user"), getMyOrders);
router.get("/owner-orders", authMiddleware,authorizeRoles("owner"), getOwnerOrders);
router.post("/update-order-status/:orderId/:shopOrderId", authMiddleware,authorizeRoles("owner"), updateOrderStatus);
router.get("/get-assignment",authMiddleware,authorizeRoles("deliveryBoy"), getAssignmentsOfDeliveryBoy);
router.post("/accept-order/:assignmentId",authMiddleware,authorizeRoles("deliveryBoy"), acceptOrder);



export default router;
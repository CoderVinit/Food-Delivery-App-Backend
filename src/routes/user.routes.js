import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/authMiddleware.js";
import { availableDeliveryBoys, getCurrentUser, updateUserLocation } from "../controllers/userController.js";

const router = express.Router();


router.get("/current-user",authMiddleware,getCurrentUser);
router.post("/update-location",authMiddleware,updateUserLocation);
router.get("/available-delivery-boys",authMiddleware,authorizeRoles("owner"),availableDeliveryBoys);



export default router;
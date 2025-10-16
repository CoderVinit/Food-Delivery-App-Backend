import express from 'express';
import { createAndEditShop, getShopByCity, getShopByOwner } from '../controllers/shop.controller.js';
import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../config/multer.js';
import { handleMulterError } from '../middleware/multer.middleware.js';

const router = express.Router();

router.post("/create-edit", 
    authMiddleware,
    authorizeRoles("owner"), 
    uploadSingle, 
    handleMulterError,
    createAndEditShop
);

router.get("/get-shop", authMiddleware, authorizeRoles("owner"), getShopByOwner);
router.get("/get-shop-by-city/:city", authMiddleware, authorizeRoles("user"), getShopByCity);
export default router;
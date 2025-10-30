import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/authMiddleware.js";
import multer from "multer";
import { createItem, EditItem, getItemsByShop, getItem, deleteItem, getAllItemsOfCity, getAllItems } from "../controllers/item.controller.js";
import { upload } from "../config/multer.js";

const router = express.Router();

router.post("/addItem", authMiddleware, authorizeRoles("owner"), upload.single('image'), createItem);
router.put("/editItem/:itemId", authMiddleware, authorizeRoles("owner"), upload.single('image'), EditItem);
router.get("/getItems", authMiddleware, authorizeRoles("owner"), getItemsByShop);
router.get("/getItem/:itemId", authMiddleware, authorizeRoles("owner"), getItem);
router.delete("/deleteItem/:itemId", authMiddleware, authorizeRoles("owner"), deleteItem);
router.get("/getItems/:city",authMiddleware,authorizeRoles("user"),getAllItemsOfCity);
router.get("/getAllItems", authMiddleware, authorizeRoles("user"), getAllItems);

export default router;
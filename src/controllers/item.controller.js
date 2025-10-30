import Item from "../models/item.model.js";
import Shop from "../models/shop.model.js";
import { uploadToCloudinary } from "../config/cloudinary.js";



export const createItem = async (req, res) => {
    try {
        const { name, category, price, foodType } = req.body;
        let image;
        if(req.file){
            try {
                console.log("Uploading item image to Cloudinary...");
                const cloudinaryResult = await uploadToCloudinary(req.file.path);
                if (cloudinaryResult.success) {
                    image = cloudinaryResult;
                } else {
                    console.error("Cloudinary upload failed:", cloudinaryResult.error);
                    // Fallback to local URL
                    image = {
                        url: `${req.protocol}://${req.get('host')}/public/${req.file.filename}`
                    };
                }
            } catch (error) {
                console.error("Error uploading to Cloudinary:", error);
                // Fallback to local URL
                image = {
                    url: `${req.protocol}://${req.get('host')}/public/${req.file.filename}`
                };
            }
        }
        const shop = await Shop.findOne({ owner: req.userId });
        if (!shop) {
            return res.status(400).json({ success: false, message: "Shop does not exist" });
        }

        const item = await Item.create({
            name,
            image: image?.url || "",
            category,
            shop: shop._id,
            price,
            foodType
        });

        // Add the item to the shop's items array
        shop.items.push(item._id);
        await shop.save();

        // Populate the shop with items to return updated data
        const updatedShop = await Shop.findById(shop._id).populate('owner items');

        res.status(201).json({
            success: true,
            data: updatedShop,
            item: item
        });
    } catch (error) {
        console.error("Error creating item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create item"
        });
    }
}

export const EditItem = async (req, res) => {
    try {
        const { name, category, price, foodType } = req.body;
        const { itemId } = req.params;

        let image;
        if(req.file){
            try {
                console.log("Uploading updated item image to Cloudinary...");
                const cloudinaryResult = await uploadToCloudinary(req.file.path);
                if (cloudinaryResult.success) {
                    image = cloudinaryResult;
                } else {
                    console.error("Cloudinary upload failed:", cloudinaryResult.error);
                    // Fallback to local URL
                    image = {
                        url: `${req.protocol}://${req.get('host')}/public/${req.file.filename}`
                    };
                }
            } catch (error) {
                console.error("Error uploading to Cloudinary:", error);
                // Fallback to local URL
                image = {
                    url: `${req.protocol}://${req.get('host')}/public/${req.file.filename}`
                };
            }
        }

        let item = await Item.findById(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // Check if the item belongs to the user's shop
        const shop = await Shop.findOne({ owner: req.userId });
        if (!shop || !item.shop.equals(shop._id)) {
            return res.status(403).json({ 
                success: false, 
                message: "Not authorized to edit this item" 
            });
        }

        item = await Item.findByIdAndUpdate(
            itemId,
            {
                name,
                category,
                price,
                foodType,
                image: image?.url || item.image
            },
            { new: true }
        );

        // Return updated shop data with items populated
        const updatedShop = await Shop.findById(shop._id).populate('owner items');

        res.status(200).json({
            success: true,
            data: updatedShop,
            item: item
        });
    } catch (error) {
        console.error("Error editing item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to edit item"
        });
    }
}

export const getItemsByShop = async (req, res) => {
    try {
        const shop = await Shop.findOne({ owner: req.userId });
        if (!shop) {
            return res.status(404).json({ 
                success: false, 
                message: "Shop not found" 
            });
        }

        const items = await Item.find({ shop: shop._id }).sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error("Error fetching items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch items"
        });
    }
}

export const getItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        
        const item = await Item.findById(itemId).populate('shop');
        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: "Item not found" 
            });
        }

        // Check if the item belongs to the user's shop
        const shop = await Shop.findOne({ owner: req.userId });
        if (!shop || !item.shop.equals(shop._id)) {
            return res.status(403).json({ 
                success: false, 
                message: "Not authorized to access this item" 
            });
        }

        res.status(200).json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error("Error fetching item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch item"
        });
    }
}

export const deleteItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        
        const item = await Item.findByIdAndDelete(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        // Also remove the item from the shop's items array
        const shop = await Shop.findOne({ owner: req.userId });
        if (shop) {
            shop.items = shop.items.filter(i => !i.equals(item._id));
            await shop.populate({
                path: 'items',
                options: { sort: { updatedAt: -1 } } // Sort items by creation date descending
            });
            await shop.save();
        }
        res.status(200).json({ success: true, message: "Item deleted successfully", data: shop });
    } catch (error) {
        console.error("Error deleting item:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete item"
        });
    }
}

export const getAllItemsOfCity = async(req,res)=>{
    try {
        const {city} = req.params;
        console.log(city)
        const shops = await Shop.find({city: { $regex: city, $options: 'i' }});
        if(!shops || shops.length === 0){
            return res.status(404).json({
                success: false,
                message: "No shops found in this city"
            });
        }
        const shopIds = shops.map(shop => shop._id);
        const allItems = await Item.find({shop:{$in: shopIds}}).populate('shop');
        console.log(allItems)
        res.status(200).json({
            success: true,
            data: allItems
        });
    } catch (error) {
        console.error("Error fetching items by city:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch items by city"
        });
    }
}


export const getAllItems = async(req,res)=>{
    try {
        let pagination = {};
        const { page = 1, limit = 5 } = req.query;
        pagination.skip = (page - 1) * limit;
        pagination.limit = limit;
        pagination.total = await Item.countDocuments();

        const allItems = await Item.find().populate('shop')
            .skip(pagination.skip)
            .limit(pagination.limit);
        res.status(200).json({
            success: true,
            data: allItems,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: pagination.total,
                totalPages: Math.ceil(pagination.total / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching all items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch all items"
        });
    }
}
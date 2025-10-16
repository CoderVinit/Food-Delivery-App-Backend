import { uploadToCloudinary } from "../config/cloudinary.js";
import Shop from "../models/shop.model.js";
import fs from "fs";
import path from "path";


export const createAndEditShop = async(req, res) => {
    try {
     const {name, city, address, state} = req.body;

    //  if(!name || !city || !address || !state){
    //     return res.status(400).json({
    //         success: false,
    //         message: "All fields are required"
    //     });
    //  }

     let image;
     if(req.file){
        try {
            // Upload to Cloudinary using the file path
            const cloudinaryResult = await uploadToCloudinary(req.file.path);
            if (cloudinaryResult.success) {
                image = cloudinaryResult;
                // Delete local file after successful Cloudinary upload
                try {
                    fs.unlinkSync(req.file.path);
                } catch (deleteError) {
                    console.error("Error deleting local file:", deleteError);
                }
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

     let shop = await Shop.findOne({owner: req.userId});
     if(!shop){
         // Creating new shop
         const shopData = {
            name,
            address,
            state,
            owner: req.userId,
            city
         };
         
         // Only add image if it exists
         if (image?.url) {
             shopData.image = image.url;
         }
         
         shop = await Shop.create(shopData);
     }else{
        // Updating existing shop
        const updateData = {
            name,
            address,
            state,
            city
        };
        
        // Only update image if new image is uploaded
        if (image?.url) {
            updateData.image = image.url;
        }
        
        shop = await Shop.findOneAndUpdate(
            {owner: req.userId},
            updateData,
            {new: true}
        );
     }

    await shop.populate('owner');
    await shop.populate('items'); // Also populate items

    res.status(201).json({
        success: true,
        data: shop
    });

    } catch (error) {
        console.error("Error creating shop:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create shop"
        });
    }

};


export const getShopByOwner = async(req, res) => {
    try {
        const shop = await Shop.findOne({owner: req.userId})
        .populate('owner')
        .populate("items");

        if(!shop){
            return res.status(404).json({
                success: false,
                message: "Shop not found"
            });
        }
        res.status(200).json({
            success: true,
            data: shop
        });
    } catch (error) {
        console.error("Error fetching shop:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch shop"
        });
    }
};


export const getShopByCity = async(req, res) => {
    try {
        const {city} = req.params; // Changed from req.body to req.query for GET request

        if(!city) {
            return res.status(400).json({
                success: false,
                message: "City parameter is required"
            });
        }

        const shops = await Shop.find({city: { $regex: city, $options: 'i' }}) // Case-insensitive search
        .populate('owner')
        .populate({
            path: 'items',
            options: { sort: { updatedAt: -1 } } 
        });
        
        console.log("Shops found:", shops.length);
        
        res.status(200).json({
            success: true,
            data: shops,
            count: shops.length
        });
    } catch (error) {
        console.error("Error fetching shops:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch shops"
        });
    }
}
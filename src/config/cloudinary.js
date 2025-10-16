import { v2 as cloudinary } from "cloudinary";
import fs from 'fs';

// Don't configure immediately - wait for explicit configuration
let isConfigured = false;

// Function to configure Cloudinary (lazy loading)
const configureCloudinary = () => {
    if (isConfigured) return true;
    
    console.log('Environment variables check:');
    console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Missing');
    console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
    console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.log('⚠️ Cloudinary credentials missing - uploads will use local storage');
        return false;
    }

    // Configure Cloudinary
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    isConfigured = true;
    console.log('✅ Cloudinary configuration completed successfully');
    return true;
};

// Function to upload image to Cloudinary
export const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Configure Cloudinary if not already done
        if (!configureCloudinary()) {
            throw new Error("Cloudinary credentials not configured. Check your .env file.");
        }

        console.log(`Uploading file to Cloudinary: ${filePath}`);
        console.log('Using Cloudinary config:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
            api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
        });
        
        const result = await cloudinary.uploader.upload(filePath, {
            folder: "food-delivery-app",
            resource_type: "auto",
            ...options
        });

        console.log("Cloudinary upload successful:", result.secure_url);

        // Delete the local file after successful upload
        try {
            fs.unlinkSync(filePath);
            console.log("Local file deleted:", filePath);
        } catch (deleteError) {
            console.error("Error deleting local file:", deleteError.message);
        }

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height
        };
    } catch (error) {
        console.error("Cloudinary upload error:", error.message);
        
        // Try to delete the local file even if upload failed
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log("Local file deleted after failed upload:", filePath);
            }
        } catch (deleteError) {
            console.error("Error deleting local file after failed upload:", deleteError.message);
        }

        return {
            success: false,
            error: error.message
        };
    }
};

// Function to delete image from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) {
            throw new Error("Public ID is required for deletion");
        }

        // Configure Cloudinary if not already done
        if (!configureCloudinary()) {
            throw new Error("Cloudinary credentials not configured. Check your .env file.");
        }

        console.log(`Deleting image from Cloudinary: ${publicId}`);
        
        const result = await cloudinary.uploader.destroy(publicId);
        
        console.log("Cloudinary delete result:", result);
        
        return {
            success: result.result === 'ok',
            result: result.result
        };
    } catch (error) {
        console.error("Cloudinary delete error:", error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

// Function to check Cloudinary configuration
export const checkCloudinaryConfig = () => {
    return configureCloudinary();
};

export default cloudinary;

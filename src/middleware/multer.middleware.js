import multer from "multer";

export const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File size too large. Maximum size is 5MB."
            });
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: "Unexpected field name for file upload."
            });
        }
    }
    
    if (error.message === "Only image files are allowed!") {
        return res.status(400).json({
            success: false,
            message: "Only image files (jpg, jpeg, png, gif, webp) are allowed."
        });
    }

    return res.status(500).json({
        success: false,
        message: "File upload error: " + error.message
    });
};
import jwt from "jsonwebtoken";

export const authenticateToken = (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token provided"
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token"
                });
            }
            
            req.user = user;
            next();
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Authentication failed"
        });
    }
};

export const validateToken = (req, res) => {
    // If we reach here, the token is valid (middleware passed)
    res.status(200).json({
        success: true,
        message: "Token is valid",
        user: req.user
    });
};
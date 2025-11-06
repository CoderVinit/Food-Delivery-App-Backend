import jwt from "jsonwebtoken";



export const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    
    // Debug logging for troubleshooting
    console.log('Auth Debug:', {
        hasToken: !!token,
        cookies: Object.keys(req.cookies),
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']?.substring(0, 50)
    });
    
    if (!token) {
        console.log('No token found in cookies');
        return res.status(401).json({ success: false, message: 'Unauthorized - No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        // console.log('Auth success:', { userId: req.userId, role: req.userRole });
        next();
    } catch (error) {
        // console.log('Token verification failed:', error.message);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        next();
    }
};

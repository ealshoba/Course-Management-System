const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify JWT and (optionally) role
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'Access denied / No token provided.' });

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // If user still must change password then block all routes
        if (decoded.mustChangePassword) {
            return res
                .status(403)
                .json({ error: 'You must change your password before using the system.' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

// Middleware to check role (admin, ta, student)
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions.' });
        }
        next();
    };
}

module.exports = { verifyToken, requireRole };
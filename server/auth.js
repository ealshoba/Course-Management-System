const express = require('express');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

const dataPath = 'data/users.json';

// Load users
let users = [];

try {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, '[]');
    }

    users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!Array.isArray(users)) users = [];

} catch (e) {
    users = [];
    fs.writeFileSync(dataPath, '[]');
}

// Helper to save users
function saveUsers() {
    fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
}

// Helper to generate JWT
function generateToken(user) {
    return jwt.sign(
        {
            email: user.email,
            role: user.role,
            memberId: user.memberId,
            mustChangePassword: user.mustChangePassword
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '1h' }
    );
}

// hash plain passwords once at startup
/*
users.forEach(u => {
    if (!u.password.startsWith('$2b$')) {
        u.password = bcrypt.hashSync(u.password, 10);
    }
});
saveUsers();
*/

// LOGIN
router.post(
    '/login',
    [
        body('email')
            .exists().withMessage('Email is required.')
            .isEmail().withMessage('Email must be valid.')
            .trim()
            .toLowerCase()
            .isLength({ max: 100 }).withMessage("Email must be at most 100 characters long.")
            .matches(/^[^\s]+$/).withMessage("Email cannot contain spaces.")
            .customSanitizer(value =>
                value.replace(/[^\p{L}\p{N}@.\-_' ]/gu, '') 
            ),

        body('password')
            .exists().withMessage('Password is required.')
            .isString()
            .isLength({ min: 4, max: 200 }).withMessage('Password must be at least 4 characters long.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { email, password } = req.body;
        const user = users.find(u => u.email === email);

        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

        if (user.mustChangePassword) {
            return res.json({
                message: 'First login - password change required.',
                mustChangePassword: true,
                email: user.email
            });
        }

        const token = generateToken(user);

        res.json({
            message: 'Login successful.',
            token,
            role: user.role,
            email: user.email
        });
    }
);


// CHANGE PASSWORD
router.post(
    '/change-password',
    [
        body('email')
            .exists().isEmail().withMessage('Valid email required.')
            .trim().toLowerCase()
            .isLength({ max: 100 }).withMessage("Email must be at most 100 characters long.")
            .matches(/^[^\s]+$/).withMessage("Email cannot contain spaces.")
            .customSanitizer(value =>
                value.replace(/[^\p{L}\p{N}@.\-_' ]/gu, '')
            ),

        body('currentPassword')
            .exists().isString().isLength({ min: 4, max: 200 }).withMessage('Current password must be between 4 and 200 characters.'),

        body('newPassword')
            .exists().isString()
            .isLength({ min: 4, max: 200 }).withMessage('New password must be at least 4 characters long.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { email, currentPassword, newPassword } = req.body;
        const user = users.find(u => u.email === email);

        if (!user) return res.status(404).json({ error: 'User not found.' });

        const valid = bcrypt.compareSync(currentPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });

        if (newPassword === currentPassword)
            return res.status(400).json({ error: 'New password must be different from current password.' });

        user.password = bcrypt.hashSync(newPassword, 10);
        user.mustChangePassword = false;
        saveUsers();

        res.json({ message: 'Password updated successfully. Please log in again.' });
    }
);

module.exports = router;
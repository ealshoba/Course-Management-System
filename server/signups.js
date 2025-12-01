const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const fs = require('fs');
const { verifyToken, requireRole } = require('./authMiddleware');

function loadJsonFile(path, defaultValue) {
    try {
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        const data = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
        return data;
    } catch (e) {
        fs.writeFileSync(path, JSON.stringify(defaultValue, null, 2));
        return defaultValue;
    }
}

const signups = loadJsonFile("data/signups.json", []);
const courses = loadJsonFile("data/courses.json", []);
const slots = loadJsonFile("data/slots.json", {});

function getNextSignupId() {
    if (signups.length === 0) return 1;
    return signups[signups.length - 1].signupId + 1;
}

// Create a signup sheet
router.post(
    '/create',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),

        body('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be a number between 1 and 99.')
            .toInt(),

        body('assignmentName')
            .exists().withMessage('assignmentName is required.')
            .isString().withMessage('assignmentName must be a string.')
            .trim()
            .isLength({ min: 1 }).withMessage('assignmentName must not be empty.')
            .isLength({ max: 100 }).withMessage('assignmentName must not exceed 100 characters.')
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('notBefore')
            .exists().withMessage('notBefore is required.')
            .isISO8601().withMessage('notBefore must be a valid timestamp.'),

        body('notAfter')
            .exists().withMessage('notAfter is required.')
            .isISO8601().withMessage('notAfter must be a valid timestamp.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        let { termCode, section = 1, assignmentName, notBefore, notAfter } = req.body;

        const course = courses.find(c => c.termCode == termCode && c.section == section);
        if (!course) return res.status(404).json({ error: "Course not found." });

        const existingSignup = signups.find(
            signup => signup.termCode === termCode && signup.section === section && signup.assignmentName === assignmentName
        );

        if (existingSignup) {
            return res.status(400).json({ error: "A sign-up sheet with this assignment name already exists for this course." });
        }

        const newSignup = {
            signupId: getNextSignupId(),
            termCode,
            section,
            assignmentName,
            notBefore,
            notAfter
        };

        signups.push(newSignup);
        fs.writeFileSync("data/signups.json", JSON.stringify(signups, null, 2));

        res.status(201).json({ signup: newSignup });
    }
);

// Get signup sheets for a course
router.get(
    '/:termCode',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        param('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),

        query('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be a number between 1 and 99.')
            .toInt()
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        const { termCode } = req.params;
        const section = req.query.section || 1;

        const result = signups.filter(signup => signup.termCode == termCode && signup.section == section);

        res.json(result);
    }
);

// Delete a signup sheet
router.delete(
    '/delete',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        body('signupId')
            .exists().withMessage('signupId required.')
            .isInt({ min: 1 }).withMessage('signupId must be a positive integer.')
            .toInt()
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        let { signupId } = req.body;

        // Find the sign-up sheet to delete
        const signupSheet = signups.find(signup => signup.signupId == signupId);
        if (!signupSheet) return res.status(404).json({ error: "Signup sheet not found." });

        // Check if the signupId has any associated slots
        const slotsForSignup = slots[signupId];
        if (slotsForSignup && slotsForSignup.length > 0) {
            return res.status(400).json({ error: "Cannot delete a sign-up sheet that has associated slots." });
        }

        // Proceed with the deletion if no slots exist
        const index = signups.findIndex(signup => signup.signupId == signupId);
        signups.splice(index, 1);

        // Remove the corresponding slots 
        delete slots[signupId];

        // Write back to the files
        fs.writeFileSync("data/signups.json", JSON.stringify(signups, null, 2));
        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.json({ deleted: signupSheet });
    }
);

module.exports = router;
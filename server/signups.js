const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const fs = require('fs');

const signups = JSON.parse(fs.readFileSync("data/signups.json"));
const courses = JSON.parse(fs.readFileSync("data/courses.json"));

function getNextSignupId() {
    if (signups.length === 0) return 1;
    return signups[signups.length - 1].signupId + 1;
}

// Create a signup sheet
router.post(
    '/create',
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

        const index = signups.findIndex(signup => signup.signupId == signupId);

        if (index === -1) return res.status(404).json({ error: "Signup sheet not found." });

        const removed = signups.splice(index, 1);
        fs.writeFileSync("data/signups.json", JSON.stringify(signups, null, 2));
        res.json({ deleted: removed[0] });
    }
);

module.exports = router;
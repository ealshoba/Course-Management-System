const express = require('express');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const router = express.Router();
const { verifyToken, requireRole } = require('./authMiddleware');

const dataPath = "data/courses.json";
const signupPath = "data/signups.json";

// Load initial data
function loadJSON(path) {
    try {
        if (!fs.existsSync(path)) fs.writeFileSync(path, '[]');
        const raw = fs.readFileSync(path, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        fs.writeFileSync(path, '[]');
        return [];
    }
}

let courses = loadJSON(dataPath);
let signups = loadJSON(signupPath);


router.get(
    '/',
    (req, res) => {
    res.json(courses.map(course => ({
        termCode: course.termCode,
        courseName: course.courseName,
        section: course.section
    })));
});

// Creat a course
router.post(
    '/create',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),

        body('courseName')
            .exists().withMessage('courseName is required.')
            .isString().withMessage('courseName must be a string.')
            .trim()
            .isLength({ min: 1 }).withMessage('courseName must not be empty.')
            .isLength({ max: 100 }).withMessage('courseName must not exceed 100 characters.')
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be a number between 1 and 99.')
            .toInt()
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { termCode, courseName, section = 1 } = req.body;

        if (courses.find(c => c.termCode === termCode && c.section === section)) {
            return res.status(400).json({ error: 'Course with this termCode and section already exists.' });
        }

        const newCourse = {
            termCode,
            courseName,
            section,
            members: []
        };

        courses.push(newCourse);
        fs.writeFileSync(dataPath, JSON.stringify(courses, null, 2));

        res.json({ course: newCourse });
    }
);

// Modify a course
router.put(
    '/modify',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),

        body('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be between 1 and 99.')
            .toInt(),

        body('newSection')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('newSection must be between 1 and 99.')
            .toInt(),

        body('courseName')
            .optional()
            .isString().withMessage('courseName must be a string.')
            .trim()
            .isLength({ min: 1 }).withMessage('courseName must not be empty.')
            .isLength({ max: 100 }).withMessage('courseName must not exceed 100 characters.')
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { termCode, section = 1, courseName, newSection } = req.body;

        const index = courses.findIndex(c => c.termCode === termCode && c.section === section);
        if (index === -1) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        const hasSignupSheet = signups.some(s => s.termCode === termCode && s.section === section);
        if (hasSignupSheet) {
            
            if (newSection) {
                return res.status(400).json({ error: 'Cannot modify section: course has an associated sign-up sheet.' });
            }
        }

        if (newSection && newSection !== section) {
            const conflict = courses.find(c => c.termCode === termCode && c.section === newSection);
            if (conflict) {
                return res.status(400).json({ error: 'Another course with this termCode and newSection already exists.' });
            }
        }

        if (courseName) courses[index].courseName = courseName;
        
        if (newSection && !hasSignupSheet) courses[index].section = newSection;

        fs.writeFileSync(dataPath, JSON.stringify(courses, null, 2));

        res.json({ message: 'Course updated.', course: courses[index] });
    }
);

// Delete a course
router.delete(
    '/delete',
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
            .toInt()
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { termCode, section = 1 } = req.body;

        const index = courses.findIndex(c => c.termCode === termCode && c.section === section);
        if (index === -1) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        const hasSignupSheet = signups.some(s => s.termCode === termCode && s.section === section);
        if (hasSignupSheet) {
            return res.status(400).json({ error: 'Cannot delete course: course has an associated sign-up sheet.' });
        }

        const removed = courses.splice(index, 1);
        fs.writeFileSync(dataPath, JSON.stringify(courses, null, 2));

        res.json({ course: removed[0] });
    }
);

module.exports = router;
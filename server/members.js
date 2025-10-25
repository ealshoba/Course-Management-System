const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const fs = require('fs');
const router = express.Router();
let courses = JSON.parse(fs.readFileSync("data/courses.json"));

//Get members by term with section = 1 and role
router.get(
    '/:termCode',
    [
        param('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),
        query('role')
            .optional()
            .isString().trim()
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { termCode } = req.params;
        const { role } = req.query;
        const section = 1;

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course) return res.status(404).json({ error: "Course not found." });

        let members = course.members || [];
        if (role && role.trim() !== "") {
            members = members.filter(m => m.role === role);
        }

        res.json(members);
    }
);


//Get members by term with sections and role
router.get(
    '/:termCode/:section',
    [
        param('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),
        param('section')
            .exists().withMessage('section is required.')
            .isInt({ min: 1, max: 99 }).withMessage('section must be between 1 and 99.')
            .toInt(),
        query('role')
            .optional()
            .isString().trim()
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        const { termCode, section } = req.params;
        const { role } = req.query;

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course) return res.status(404).json({ error: "Course not found." });

        let members = course.members || [];
        if (role && role.trim() !== "") {
            members = members.filter(m => m.role === role);
        }

        res.json(members);
    }
);


//Add members
router.post(
    '/add',
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be a number between 1 and 9999.')
            .toInt(),
        body('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be between 1 and 99.')
            .toInt(),
        body('members')
            .isArray({ min: 1 }).withMessage('members must be a non-empty array.'),

        body('members.*.memberId')
            .exists().withMessage('memberId is required.')
            .isLength({ min: 8, max: 8 }).withMessage('memberId must be exactly 8 characters.')
            .trim()
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('members.*.firstName')
            .exists().withMessage('firstName is required.')
            .isLength({ min: 1, max: 200 }).withMessage('firstName must not exceed 200 characters.')
            .trim()
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('members.*.lastName')
            .exists().withMessage('lastName is required.')
            .isLength({ min: 1, max: 200 }).withMessage('lastName must not exceed 200 characters.')
            .trim()
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('members.*.role')
            .exists().withMessage('role is required.')
            .isLength({ min: 1, max: 10 }).withMessage('role must not exceed 10 characters.')
            .trim()
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        let { termCode, section = 1, members } = req.body;

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course) return res.status(404).json({ error: "Course not found." });

        if (!course.members) course.members = [];

        const existingIds = new Set(course.members.map(m => m.memberId));
        const ignored = [];
        let addedCount = 0;

        for (const member of members) {
            const { memberId, firstName, lastName, role } = member;

            if (existingIds.has(memberId)) {
                ignored.push(memberId);
                continue;
            }

            course.members.push({ memberId, firstName, lastName, role });
            existingIds.add(memberId);
            addedCount++;
        }

        fs.writeFileSync("data/courses.json", JSON.stringify(courses, null, 2));

        res.status(200).json({
            addedCount,
            ignored
        });
    }
);


//Delete members
router.post(
    '/deleteMembers',
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be between 1 and 9999.')
            .toInt(),
        body('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be between 1 and 99.')
            .toInt(),
        body('memberIds')
            .isArray({ min: 1 }).withMessage('memberIds must be a non-empty array.'),
        body('memberIds.*')
            .isString()
            .trim()
            .isLength({ min: 1, max: 50 })
            .customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });
        }

        let { termCode, section = 1, memberIds } = req.body;

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course) return res.status(404).json({ error: "Course not found." });

        if (!course.members) course.members = [];

        const originalCount = course.members.length;
        const idsSet = new Set(memberIds);
        const existingIds = new Set(course.members.map(m => m.memberId));
        const notFound = memberIds.filter(id => !existingIds.has(id));

        course.members = course.members.filter(m => !idsSet.has(m.memberId));
        const deletedCount = originalCount - course.members.length;

        fs.writeFileSync("data/courses.json", JSON.stringify(courses, null, 2));

        res.status(200).json({
            deletedCount,
            notFound
        });
    }
);

module.exports = router;
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const fs = require('fs');
const router = express.Router();
const bcrypt = require('bcryptjs');
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

const loadUsers = () => loadJsonFile("data/users.json", []);
const loadCourses = () => loadJsonFile("data/courses.json", []);
const loadSignups = () => loadJsonFile("data/signups.json", []);
const saveUsers = data => fs.writeFileSync("data/users.json", JSON.stringify(data, null, 2));
const saveCourses = data => fs.writeFileSync("data/courses.json", JSON.stringify(data, null, 2));
const saveSignups = data => fs.writeFileSync("data/signups.json", JSON.stringify(data, null, 2));

//Get members by term with section = 1 and role
router.get(
    '/:termCode',
    verifyToken,
    requireRole('admin', 'ta'),
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

        const courses = loadCourses();
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
    verifyToken,
    requireRole('admin', 'ta'),
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

        const courses = loadCourses();
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
        body('members')
            .isArray({ min: 1 }).withMessage('members must be a non-empty array.'),

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

        body('members.*.email')
            .exists().withMessage("email is required.")
            .isEmail().withMessage("Invalid email.")
            .trim(),

        body('members.*.password')
            .exists().withMessage("password is required.")
            .isLength({ min: 4, max: 200 }).withMessage("Password must be at least 4 characters.")
            .trim()
    ],

    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        const { termCode, section = 1, members } = req.body;

        let users = loadUsers();        // read users.json
        let courses = loadCourses();    // read courses.json

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course)
            return res.status(404).json({ error: "Course not found." });

        if (!course.members) course.members = [];

        // Generate memberId
        const generateMemberId = () => {
            let max = 0;
            users.forEach(u => {
                const num = parseInt(u.memberId?.substring(1)) || 0;
                if (num > max) max = num;
            });
            return "M" + (max + 1).toString().padStart(7, "0");
        };

        const added = [];
        const ignored = [];

        for (const m of members) {
            const { lastName, firstName, email, password } = m;

            if (course.members.some(mem => mem.email === email)) {
                ignored.push(email);
                continue;
            }

            let user = users.find(u => u.email === email);
            let memberId;

            if (!user) {
                
                memberId = generateMemberId();

                const hashed = bcrypt.hashSync(password, 10);

                user = {
                    memberId,
                    email,
                    password: hashed,
                    role: "student",
                    mustChangePassword: true
                };

                users.push(user);
            } else {
                memberId = user.memberId;
            }

            // Add to course
            const newMember = {
                memberId,
                firstName,
                lastName,
                email,
                role: "student"
            };

            course.members.push(newMember);
            added.push(newMember);
        }

        saveUsers(users);
        saveCourses(courses);

        res.status(200).json({
            addedCount: added.length,
            ignored,
            added
        });
    }
);


//Delete members
router.delete(
    '/deleteMembers',
    verifyToken,
    requireRole('admin', 'ta'),
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
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        const { termCode, section = 1, memberIds } = req.body;

        // Load all required data
        const courses = loadCourses();
        const signups = loadSignups();

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course)
            return res.status(404).json({ error: "Course not found." });

        if (!course.members)
            course.members = [];

        // Block deletion if any signup exists for this course
        const courseHasSignup = signups.some(s =>
            s.termCode === termCode && s.section === section
        );

        if (courseHasSignup) {
            return res.status(400).json({
                error: "Cannot delete members because this course has sign-ups."
            });
        }

        // No signups, Safe to delete members
        const before = course.members.length;

        course.members = course.members.filter(
            m => !memberIds.includes(m.memberId)
        );

        const after = course.members.length;

        saveCourses(courses);

        return res.status(200).json({
            deletedCount: before - after
        });
    }
);

// Add TA (admin only)
router.post(
    '/addTA',
    verifyToken,
    requireRole('admin'),
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 }).withMessage('termCode must be 1–9999.')
            .toInt(),

        body('section')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('section must be 1–99.')
            .toInt(),

        body('firstName')
            .exists().withMessage('firstName is required.')
            .isLength({ min: 1, max: 200 })
            .trim()
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('lastName')
            .exists().withMessage('lastName is required.')
            .isLength({ min: 1, max: 200 })
            .trim()
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('email')
            .exists().withMessage('email is required.')
            .isEmail().withMessage('Invalid email.')
            .trim(),

        body('password')
            .optional()
            .isLength({ min: 4, max: 200 })
            .trim()
    ],
    (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        const { termCode, section = 1, firstName, lastName, email, password } = req.body;

        let users = loadUsers();
        let courses = loadCourses();

        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course)
            return res.status(404).json({ error: "Course not found." });

        if (!course.members) course.members = [];

        // Find if user already exists
        let existingUser = users.find(u => u.email === email);
        let memberId;

        // Generate ID function
        const generateMemberId = () => {
            let max = 0;
            users.forEach(u => {
                const num = parseInt(u.memberId?.substring(1)) || 0;
                if (num > max) max = num;
            });
            return "M" + (max + 1).toString().padStart(7, "0");
        };

        if (!existingUser) {
            // Must have password for new user
            if (!password)
                return res.status(400).json({ error: "Password is required for new TA." });

            memberId = generateMemberId();

            const hashed = bcrypt.hashSync(password, 10);

            existingUser = {
                memberId,
                email,
                password: hashed,
                role: "ta",
                mustChangePassword: true
            };

            users.push(existingUser);
        } else {
            // If already exists, upgrade role to TA
            existingUser.role = "ta";
            memberId = existingUser.memberId;
        }

        // Add TA to course
        let existingMember = course.members.find(m => m.memberId === memberId);
        if (!existingMember) {
            course.members.push({
                memberId,
                firstName,
                lastName,
                email,
                role: "ta"
            });
        } else {
            existingMember.role = "ta";
        }

        saveUsers(users);
        saveCourses(courses);

        res.json({
            message: "TA added successfully.",
            member: { memberId, firstName, lastName, email, role: "ta" }
        });
    }
);

// Remove TA (admin only)
router.post(
    '/removeTA',
    verifyToken,
    requireRole('admin'),
    [
        body('termCode')
            .exists().withMessage('termCode is required.')
            .isInt({ min: 1, max: 9999 })
            .toInt(),

        body('section')
            .exists().withMessage('section is required.')
            .isInt({ min: 1, max: 99 })
            .toInt(),

        body('memberId')
            .exists().withMessage('memberId is required.')
            .isString()
            .trim()
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        const { termCode, section, memberId } = req.body;

        const courses = loadCourses();
        const users = loadUsers();

        // Find course
        const course = courses.find(c => c.termCode === termCode && c.section === section);
        if (!course || !course.members)
            return res.status(404).json({ error: "Course not found." });

        // Find member in course
        const member = course.members.find(m => m.memberId === memberId);
        if (!member)
            return res.status(404).json({ error: "User not found in this course." });

        // Ensure role is TA inside the course
        if (member.role.toLowerCase() !== "ta")
            return res.status(400).json({ error: "This user is not a TA in this course." });

        // Find user globally
        const user = users.find(u => u.memberId === memberId);
        if (!user)
            return res.status(404).json({ error: "User not found in users.json." });

        // Ensure global role is TA
        if (user.role.toLowerCase() !== "ta")
            return res.status(400).json({ error: "This user is not a TA globally." });

        // Downgrade both roles
        member.role = "student";
        user.role = "student";

        saveUsers(users);
        saveCourses(courses);

        res.json({
            message: "TA role removed successfully.",
            member
        });
    }
);

// Reset user password (admin only)
router.post(
    '/resetPassword',
    verifyToken,
    requireRole('admin'),
    [
        body('memberId')
            .exists().withMessage('memberId is required.')
            .isString()
            .trim()
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-']/gu, '')),

        body('newPassword')
            .exists().withMessage('newPassword is required.')
            .isLength({ min: 4, max: 200 })
            .trim()
    ],
    (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array().map(e => e.msg) });

        const { memberId, newPassword } = req.body;

        const users = loadUsers();
        const user = users.find(u => u.memberId === memberId);

        if (!user)
            return res.status(404).json({ error: "User not found." });

        const hashed = bcrypt.hashSync(newPassword, 10);
        user.password = hashed;
        user.mustChangePassword = true;

        saveUsers(users);

        res.json({ message: "Password reset. User must change password at next login." });
    }
);

module.exports = router;
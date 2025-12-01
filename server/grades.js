const express = require('express');
const router = express.Router();
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const { verifyToken, requireRole } = require('./authMiddleware');

// Load JSON files
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

let slots = loadJsonFile("data/slots.json", {});
let signups = loadJsonFile("data/signups.json", {});
let grades = loadJsonFile("data/grades.json", []);
let auditLogs = loadJsonFile("data/audit.json", []);
let users = loadJsonFile("data/users.json", []);

// Save DB
function saveDB() {
    fs.writeFileSync("data/grades.json", JSON.stringify(grades, null, 2));
    fs.writeFileSync("data/audit.json", JSON.stringify(auditLogs, null, 2));
}

function reloadDB() {
    grades = loadJsonFile("data/grades.json", []);
    auditLogs = loadJsonFile("data/audit.json", []);
}

// Format "YYYY-MM-DD HH:mm"
function parseDate(str) {
    return new Date(str.replace(" ", "T"));
}

// Flatten slots and sort by start time
function getAllSlots() {
    let flat = [];
    for (let signupId in slots) flat.push(...slots[signupId]);
    return flat.sort((a, b) => parseDate(a.start) - parseDate(b.start));
}

// Get current slot
function getCurrentSlot() {
    const now = new Date();
    const flat = getAllSlots();

    // Find slot where now is between start and end
    const current = flat.find(slot => {
        const start = parseDate(slot.start);
        const end = new Date(start.getTime() + slot.duration * 60 * 1000);
        return now >= start && now <= end;
    });

    // If no ongoing slot, return next upcoming slot
    if (current) return current;
    return flat.find(slot => parseDate(slot.start) > now) || null;
}

// GET slot with merged grade
router.get('/slot/:slotId',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        param('slotId').isInt().withMessage("Slot ID must be a number").toInt()
    ], (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        const slotId = req.params.slotId;
        let found = null;

        for (let signupId in slots) {
            for (let slot of slots[signupId]) {
                if (slot.slotId == slotId) {
                    found = { ...slot, signupId: Number(signupId) };
                    break;
                }
            }
            if (found) break;
        }

        if (!found) return res.status(404).json({ error: "Slot not found." });

        // Attach grade info
        found.members = found.members.map(m => {
            const g = grades.find(gr => gr.memberId === m && gr.signupId === found.signupId);
            if (!g) return { memberId: m, grade: null };

            const final = g.grade + (g.bonus || 0) - (g.penalty || 0);

            return {
                memberId: m,
                grade: g.grade,
                bonus: g.bonus || 0,
                penalty: g.penalty || 0,
                comment: g.comment || "",
                final
            };
        });

        res.json(found);
    });

// Enter or Update Grade
router.post('/enter',
    verifyToken,
    requireRole('admin', 'ta'),
    [
        body('memberId')
            .isString().withMessage("memberId must be a string")
            .customSanitizer(v => (v || "").replace(/[^\p{L}\p{N} \-']/gu, "")),

        body('signupId')
            .isInt().withMessage("signupId must be a number").toInt(),

        body('grade')
            .isInt({ min: 0, max: 999 }).withMessage("grade must be 0–999").toInt(),

        body('bonus')
            .optional()
            .isInt().withMessage("bonus must be integer").toInt(),

        body('penalty')
            .optional()
            .isInt().withMessage("penalty must be integer").toInt(),

        body('comment')
            .isString().withMessage("A comment should be a string.")
            .notEmpty().withMessage("Comment cannot be empty.")
            .customSanitizer(v => (v || "").replace(/[^\p{L}\p{N} \-']/gu, ""))

    ], (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty())
            return res.status(400).json({ errors: errors.array() });

        const { memberId, signupId, grade, bonus = 0, penalty = 0, comment } = req.body;

        const slotList = slots[String(signupId)];
        if (!slotList)
            return res.status(404).json({ error: "Signup ID not found." });

        // Student must be signed up
        let memberFound = slotList.some(s => s.members.includes(memberId));
        if (!memberFound)
            return res.status(404).json({ error: "Member not found in this signup." });

        const taMemberId = req.user?.memberId;  // TA's memberId from the token

        if (!taMemberId) {
            return res.status(401).json({ error: "Unauthorized: TA memberId not found." });
        }

        // Get the TA's user info from users.json
        const ta = users.find(u => u.memberId === taMemberId);

        if (!ta) {
            return res.status(404).json({ error: "TA not found." });
        }

        // Get the TA's username from the email (before the @)
        const username = ta.email.split('@')[0] || "unknownTA";
        const timestamp = new Date().toISOString();

        const existing = grades.find(g => g.memberId === memberId && g.signupId === signupId);

        // Modify grade
        if (existing) {

            if (comment.trim() === "")
                return res.status(400).json({ error: "Modifying a grade requires a comment." });

            const previous = { ...existing };

            existing.grade = grade;
            existing.bonus = bonus;
            existing.penalty = penalty;
            existing.comment = (existing.comment || "") + " " + comment;
            existing.updatedBy = username;
            existing.updatedAt = timestamp;

            auditLogs.push({
                action: "update",
                timestamp,
                user: username,
                previous,
                updated: existing
            });

            saveDB();
            reloadDB();

            return res.json({ message: "Grade updated.", previous, updated: existing });
        }

        // Create grade
        if (comment.trim() === "")
            return res.status(400).json({ error: "Creating a grade requires a comment." });

        const newGrade = {
            memberId,
            signupId,
            grade,
            bonus,
            penalty,
            comment,
            updatedBy: username,
            updatedAt: timestamp
        };

        grades.push(newGrade);

        auditLogs.push({
            action: "create",
            timestamp,
            user: username,
            grade: newGrade
        });

        saveDB();
        reloadDB();

        res.status(201).json({ message: "Grade added.", grade: newGrade });
    });

router.get('/all-slots',
    verifyToken,
    requireRole('admin', 'ta'),
    (req, res) => {
        const flat = getAllSlots(); // uses your existing helper to flatten all slots
        res.json(flat);
    });

// CURRENT, NEXT, PREVIOUS
router.get('/current',
    verifyToken,
    requireRole('admin', 'ta'),
    (req, res) => {
        const slot = getCurrentSlot();
        if (!slot) return res.status(404).json({ error: "No current slot." });
        res.json(slot);
    });

router.get('/previous/:slotId',
    verifyToken,
    requireRole('admin', 'ta'),
    (req, res) => {
        const slotId = parseInt(req.params.slotId);

        // Find the signup that contains this slot
        let signupIdFound = null;
        for (let sid in slots) {
            if (slots[sid].some(s => s.slotId === slotId)) {
                signupIdFound = sid;
                break;
            }
        }

        if (!signupIdFound) return res.status(404).json({ error: "Slot not found." });

        const slotList = slots[signupIdFound];
        const idx = slotList.findIndex(s => s.slotId === slotId);

        if (idx <= 0) return res.status(404).json({ error: "No previous slot in this signup." });

        res.json(slotList[idx - 1]);
    });


router.get('/next/:slotId',
    verifyToken,
    requireRole('admin', 'ta'),
    (req, res) => {
        const slotId = parseInt(req.params.slotId);

        // Find the signup that contains this slot
        let signupIdFound = null;
        for (let sid in slots) {
            if (slots[sid].some(s => s.slotId === slotId)) {
                signupIdFound = sid;
                break;
            }
        }

        if (!signupIdFound) return res.status(404).json({ error: "Slot not found." });

        const slotList = slots[signupIdFound];
        const idx = slotList.findIndex(s => s.slotId === slotId);

        if (idx === -1 || idx + 1 >= slotList.length)
            return res.status(404).json({ error: "No next slot in this signup." });

        res.json(slotList[idx + 1]);
    });

// AUDIT HISTORY
router.get('/audit/:memberId/:signupId',
    verifyToken,
    requireRole('admin', 'ta'),
    (req, res) => {
        const { memberId, signupId } = req.params;

        const history = auditLogs.filter(
            log =>
                log.grade?.memberId === memberId &&
                log.grade?.signupId == signupId
        );

        if (history.length === 0)
            return res.status(404).json({ error: "No audit history found." });

        res.json(history);
    });

module.exports = router;
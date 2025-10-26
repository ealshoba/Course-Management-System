const express = require('express');
const router = express.Router();
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');

// Load data
let slots = JSON.parse(fs.readFileSync("data/slots.json"));
let signups = JSON.parse(fs.readFileSync("data/signups.json"));
let courses = JSON.parse(fs.readFileSync("data/courses.json"));

// Get next slotId
function getNextSlotId() {
    let maxId = 0;
    for (let signupId in slots) {
        slots[signupId].forEach(slot => {
            if (slot.slotId > maxId) maxId = slot.slotId;
        });
    }
    return maxId + 1;
}

//Give this format time "YYYY-MM-DD HH:mm"
function fTime(input, minutesToAdd) {
    const date = new Date(input.replace(' ', 'T'));
    date.setMinutes(date.getMinutes() + minutesToAdd);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Add slots to a signup sheet
router.post(
    '/add',
    [
        body('signupId')
            .isInt().withMessage('signupId must be an integer.'),
        body('start')
            .isString().withMessage('start must be a string.')
            .trim()
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-:T]/gu, '')),
        body('slotDuration')
            .isInt({ min: 1, max: 240 }).withMessage('slotDuration must be between 1 and 240 minutes.'),
        body('numSlots')
            .isInt({ min: 1, max: 99 }).withMessage('numSlots must be between 1 and 99.'),
        body('maxMembers')
            .isInt({ min: 1, max: 99 }).withMessage('maxMembers must be between 1 and 99.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { signupId, start, slotDuration, numSlots, maxMembers } = req.body;

        const sheet = signups.find(s => s.signupId == signupId);
        if (!sheet) return res.status(404).json({ error: "Signup sheet not found." });

        if (!slots[signupId]) slots[signupId] = [];

        let currentStart = start;
        const newSlots = [];
        let nextId = getNextSlotId();

        for (let i = 0; i < numSlots; i++) {
            const slot = {
                slotId: nextId++,
                start: currentStart,
                duration: slotDuration,
                maxMembers: maxMembers,
                members: []
            };

            newSlots.push(slot);
            currentStart = fTime(currentStart, slotDuration);
        }

        slots[signupId].push(...newSlots);
        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.status(201).json({ added: newSlots });
    }
);

// Get list of slots for a signup sheet
router.get(
    '/:signupId',
    [param('signupId').isInt().withMessage('signupId must be an integer.')],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { signupId } = req.params;

        if (!slots[signupId]) {
            return res.status(404).json({ error: "No slots found for this signup sheet." });
        }

        res.json(slots[signupId]);
    }
);

// Modify a slot
router.put(
    '/modify',
    [
        body('slotId')
            .isInt().withMessage('slotId must be an integer.'),
        body('start')
            .optional()
            .isString().withMessage('start must be a string.')
            .trim()
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-:T]/gu, '')),
        body('duration')
            .optional()
            .isInt({ min: 1, max: 240 }).withMessage('duration must be between 1 and 240 minutes.'),
        body('maxMembers')
            .optional()
            .isInt({ min: 1, max: 99 }).withMessage('maxMembers must be between 1 and 99.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { slotId, start, duration, maxMembers } = req.body;

        let found = false;
        let memberList = [];

        for (let signupId in slots) {
            for (let i = 0; i < slots[signupId].length; i++) {
                if (slots[signupId][i].slotId == slotId) {
                    if (slots[signupId][i].members.length > 0) {
                        memberList = slots[signupId][i].members;
                    }

                    if (start) slots[signupId][i].start = start;
                    if (duration) slots[signupId][i].duration = duration;
                    if (maxMembers) slots[signupId][i].maxMembers = maxMembers;

                    found = true;
                    break;
                }
            }
        }

        if (!found) return res.status(404).json({ error: "Slot not found." });

        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));
        res.json({
            message: "Slot updated.",
            members: memberList.length > 0 ? memberList : undefined
        });
    }
);

// Sign up for an assignment
router.post(
    '/signup',
    [
        body('signupId').isInt().withMessage('signupId must be an integer.'),
        body('slotId').isInt().withMessage('slotId must be an integer.'),
        body('memberId')
            .isString().withMessage('memberId must be a string.')
            .trim()
            .isLength({ min: 8, max: 8 }).withMessage('memberId must be exactly 8 characters.')
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { signupId, slotId, memberId } = req.body;

        const signupSheet = signups.find(s => s.signupId == signupId);
        if (!signupSheet) {
            return res.status(404).json({ error: "Signup sheet not found." });
        }

        const { termCode, section } = signupSheet;

        const course = courses.find(c => c.termCode == termCode && c.section == section);
        if (!course) {
            return res.status(404).json({ error: "Course not found for this signup sheet." });
        }

        const memberExists = course.members.some(m => m.memberId === memberId);
        if (!memberExists) {
            return res.status(400).json({ error: `Member ID ${memberId} not found in this course (term ${termCode}, section ${section}).` });
        }

        if (!slots[signupId]) {
            return res.status(404).json({ error: "No slots found for this signup sheet." });
        }

        const slot = slots[signupId].find(s => s.slotId == slotId);
        if (!slot) {
            return res.status(404).json({ error: "Slot not found." });
        }

        if (slot.members.length >= slot.maxMembers) {
            return res.status(400).json({ error: "Slot is full." });
        }

        const alreadySigned = slots[signupId].some(s => s.members.includes(memberId));
        if (alreadySigned) {
            return res.status(400).json({ error: "Member already signed up for this assignment." });
        }

        slot.members.push(memberId);
        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.status(200).json({
            message: "Signup successful.",
            slot
        });
    }
);

// Delete a slot
router.delete(
    '/delete',
    [body('slotId').isInt().withMessage('slotId must be an integer.')],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { slotId } = req.body;
        let deletedSlot = null;

        for (let signupId in slots) {
            const index = slots[signupId].findIndex(s => s.slotId == slotId);
            if (index !== -1) {
                deletedSlot = slots[signupId].splice(index, 1)[0];
                break;
            }
        }

        if (!deletedSlot) {
            return res.status(404).json({ error: "Slot not found." });
        }

        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));
        res.status(200).json({ deleted: deletedSlot });
    }
);

// Delete a sign-up
router.delete(
    '/deleteSignup',
    [
        body('signupId').isInt().withMessage('signupId must be an integer.'),
        body('memberId')
            .isString().withMessage('memberId must be a string.')
            .trim()
            .isLength({ min: 8, max: 8 }).withMessage('memberId must be exactly 8 characters.')
            .customSanitizer(v => v.replace(/[^\p{L}\p{N} \-']/gu, ''))
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { signupId, memberId } = req.body;

        if (!slots.hasOwnProperty(signupId)) {
            return res.status(404).json({ error: `No signup sheet found with ID ${signupId}.` });
        }

        const sheetSlots = slots[signupId];
        let deletedFrom = null;

        for (let slot of sheetSlots) {
            const index = slot.members.indexOf(memberId);
            if (index !== -1) {
                slot.members.splice(index, 1);
                deletedFrom = slot;
                break;
            }
        }

        if (!deletedFrom) {
            return res.status(404).json({ error: `Member ${memberId} was not signed up for signupId ${signupId}.` });
        }

        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.status(200).json({
            message: "Sign-up deleted successfully.",
            slot: deletedFrom
        });
    }
);

module.exports = router;
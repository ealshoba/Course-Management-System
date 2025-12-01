const express = require('express');
const router = express.Router();
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const { verifyToken, requireRole } = require('./authMiddleware');

// Load data
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
let signups = loadJsonFile("data/signups.json", []);
let courses = loadJsonFile("data/courses.json", []);
let users = loadJsonFile('./data/users.json', []);

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

// Check if the new slot overlaps with any existing slots
function checkSlotOverlap(newStart, newDuration, signupId) {
    const newSlotStart = new Date(newStart);  // New slot start time
    const newSlotEnd = new Date(newSlotStart);
    newSlotEnd.setMinutes(newSlotStart.getMinutes() + newDuration);  // New slot end time

    // Check for overlap with existing slots in the signup sheet
    for (let slot of slots[signupId]) {
        const existingSlotStart = new Date(slot.start);  // Existing slot start time
        const existingSlotEnd = new Date(existingSlotStart);
        existingSlotEnd.setMinutes(existingSlotStart.getMinutes() + slot.duration);  // Existing slot end time

        // Check if the new slot overlaps with the existing one
        if (newSlotStart < existingSlotEnd && newSlotEnd > existingSlotStart) {
            return true;  // Overlap detected
        }
    }

    return false;  // No overlap
}

// Add slots to a signup sheet
router.post(
    '/add',
    verifyToken,
    requireRole('admin', 'ta'),
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

            if (checkSlotOverlap(slot.start, slot.duration, signupId)) {
                return res.status(400).json({ error: `The new slot starting at ${slot.start} overlaps with an existing slot.` });
            }

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
    '/signupId/:signupId',
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
    verifyToken,
    requireRole('admin', 'ta'),
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

        let foundSignupId = null;
        let foundIndex = null;

        // Locate the slot and save its position
        for (let sId in slots) {
            const idx = slots[sId].findIndex(slot => slot.slotId == slotId);
            if (idx !== -1) {
                foundSignupId = sId;
                foundIndex = idx;
                break;
            }
        }

        if (foundSignupId === null) {
            return res.status(404).json({ error: "Slot not found." });
        }

        const slot = slots[foundSignupId][foundIndex];

        // Collect new values
        const newStart = start || slot.start;
        const newDuration = duration || slot.duration;
        const newMaxMembers = maxMembers || slot.maxMembers;

        // Prevent lowering maxMembers below existing signups
        if (slot.members.length > newMaxMembers) {
            return res.status(400).json({
                error: `Cannot reduce maxMembers to ${newMaxMembers}. Slot already has ${slot.members.length} signed up.`
            });
        }

        // Overlap check excluding the current slot
        const newStartDate = new Date(newStart);
        const newEndDate = new Date(newStartDate.getTime() + newDuration * 60000);

        for (let other of slots[foundSignupId]) {
            if (other.slotId == slotId) continue;

            const existingStart = new Date(other.start);
            const existingEnd = new Date(existingStart.getTime() + other.duration * 60000);

            if (newStartDate < existingEnd && newEndDate > existingStart) {
                return res.status(400).json({
                    error: `Modified slot overlaps with slotId ${other.slotId}.`
                });
            }
        }

        // Apply changes
        slot.start = newStart;
        slot.duration = newDuration;
        slot.maxMembers = newMaxMembers;

        // Save
        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.json({
            message: "Slot updated.",
            slot
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
    verifyToken,
    requireRole('admin', 'ta'),
    [body('slotId').isInt().withMessage('slotId must be an integer.')],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { slotId } = req.body;
        let deletedSlot = null;
        let signupIdToDeleteFrom = null;

        // Look for the slot in the slots object
        for (let signupId in slots) {
            const index = slots[signupId].findIndex(s => s.slotId == slotId);
            if (index !== -1) {
                // Found the slot, assign it to deletedSlot
                deletedSlot = slots[signupId][index];
                signupIdToDeleteFrom = signupId;
                break;
            }
        }

        // If no slot was found, return an error
        if (!deletedSlot) {
            return res.status(404).json({ error: "Slot not found." });
        }

        // Check if there are members before proceeding with deletion
        if (deletedSlot.members.length > 0) {
            return res.status(400).json({ error: "Cannot delete a slot that already has sign-ups." });
        }

        // Safely delete the slot from the array, since we know it's free of members
        const indexToRemove = slots[signupIdToDeleteFrom].findIndex(s => s.slotId == slotId);
        if (indexToRemove !== -1) {
            const removedSlot = slots[signupIdToDeleteFrom].splice(indexToRemove, 1)[0];
            fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));
            res.status(200).json({ deleted: removedSlot });
        } else {
            res.status(404).json({ error: "Slot not found after rechecking." });
        }
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

// Show all slots the student has signed up for
router.get(
    '/mySlots',
    verifyToken,
    requireRole('student'),
    (req, res) => {
        const memberId = req.user.memberId;

        const signedUpSlots = [];

        for (let signupId in slots) {
            for (let slot of slots[signupId]) {
                if (slot.members.includes(memberId)) {
                    signedUpSlots.push({
                        signupId: Number(signupId),
                        ...slot
                    });
                }
            }
        }

        res.json({ slots: signedUpSlots });
    }
);

// Show available slots for student
router.get(
    '/availableSlots',
    verifyToken,
    requireRole('student'),
    (req, res) => {
        const memberId = req.user.memberId;
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const availableSlots = [];

        for (let signupId in slots) {

            const sheet = signups.find(s => s.signupId == signupId);
            if (!sheet) continue;

            const course = courses.find(c =>
                c.termCode == sheet.termCode &&
                c.section == sheet.section
            );
            if (!course) continue;

            // Check the student is in the course
            if (!course.members.some(m => m.memberId === memberId)) continue;

            const sheetSlots = slots[signupId];

            // Check if the student already signed up in this signupId
            const alreadySignedUp = sheetSlots.some(s => s.members.includes(memberId));

            if (alreadySignedUp) {
                // If already signed up, skip this signup sheet completely
                continue;
            }

            // Otherwise return eligible available slots
            for (let slot of sheetSlots) {
                const slotStart = new Date(slot.start.replace(' ', 'T'));

                const slotIsOneHourAhead = slotStart > oneHourLater;
                const slotHasSpace = slot.members.length < slot.maxMembers;

                if (slotIsOneHourAhead && slotHasSpace) {
                    availableSlots.push({
                        signupId: Number(signupId),
                        ...slot
                    });
                }
            }
        }

        res.json({ slots: availableSlots });
    }
);

// Sign up for a slot (≥1 hour ahead)
router.post(
    '/studentSignup',
    verifyToken,
    requireRole('student'),
    [
        body('signupId')
            .isInt().withMessage('signupId must be an integer.'),
        body('slotId')
            .isInt().withMessage('slotId must be an integer.'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { signupId, slotId } = req.body;
        const memberId = req.user.memberId;

        if (!slots[signupId]) {
            return res.status(404).json({ error: "Signup sheet not found." });
        }

        const sheetSlots = slots[signupId];
        const slot = sheetSlots.find(s => s.slotId == slotId);
        if (!slot) {
            return res.status(404).json({ error: "Slot not found." });
        }

        // Verify the student belongs to the course for this signupId
        const sheet = signups.find(s => s.signupId == signupId);
        if (!sheet) {
            return res.status(404).json({ error: "Signup sheet metadata not found." });
        }

        const course = courses.find(c =>
            c.termCode == sheet.termCode &&
            c.section == sheet.section
        );

        if (!course) {
            return res.status(404).json({ error: "Course not found for this signup sheet." });
        }

        // If student is not in the course then block immediately
        const isInCourse = course.members.some(m => m.memberId === memberId);
        if (!isInCourse) {
            return res.status(403).json({
                error: "You are not enrolled in this course, so you cannot sign up."
            });
        }

        // check if the student already signed up in this sheet
        const alreadyInSignupSheet = sheetSlots.some(s => s.members.includes(memberId));
        if (alreadyInSignupSheet) {
            return res.status(400).json({
                error: "You have already signed up for a slot in this signup sheet."
            });
        }

        // 1-hour rule
        const now = new Date();
        const slotStart = new Date(slot.start.replace(' ', 'T'));
        if ((slotStart - now) < 60 * 60 * 1000) {
            return res.status(400).json({
                error: "Cannot sign up for a slot less than 1 hour away."
            });
        }

        // Capacity check
        if (slot.members.length >= slot.maxMembers) {
            return res.status(400).json({ error: "Slot is full." });
        }

        // Save signup
        slot.members.push(memberId);
        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.json({ message: "Signup successful.", slot });
    }
);

// Leave a slot (≥2 hours ahead)
router.post(
    '/leaveSlot',
    verifyToken,
    requireRole('student'),
    [
        body('signupId')
            .isInt().withMessage('signupId must be an integer.'),
        body('slotId')
            .isInt().withMessage('slotId must be an integer.'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { signupId, slotId } = req.body;
        const memberId = req.user.memberId;

        if (!slots[signupId]) return res.status(404).json({ error: "Signup sheet not found." });

        const slot = slots[signupId].find(s => s.slotId == slotId);
        if (!slot) return res.status(404).json({ error: "Slot not found." });

        // Check membership first
        const index = slot.members.indexOf(memberId);
        if (index === -1) {
            return res.status(400).json({ error: "You are not signed up for this slot." });
        }

        // Then check 2-hour rule
        const now = new Date();
        const slotStart = new Date(slot.start.replace(' ', 'T'));
        if ((slotStart - now) < 2 * 60 * 60 * 1000) {
            return res.status(400).json({ error: "Cannot leave a slot less than 2 hours away." });
        }

        // Remove student from slot
        slot.members.splice(index, 1);
        fs.writeFileSync("data/slots.json", JSON.stringify(slots, null, 2));

        res.json({ message: "Successfully left the slot.", slot });
    }
);

module.exports = router;
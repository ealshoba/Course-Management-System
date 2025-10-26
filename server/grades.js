const express = require('express');
const router = express.Router();
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');

const slots = JSON.parse(fs.readFileSync("data/slots.json"));
const signups = JSON.parse(fs.readFileSync("data/signups.json"));
let grades = JSON.parse(fs.readFileSync("data/grades.json"));

// Get a list of members for a given slot
router.get('/:slotId', [
    param('slotId').isInt().withMessage('Slot ID must be a number').toInt(),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { slotId } = req.params;
    let fSlot = null;

    for (let signupId in slots) {
        for (let slot of slots[signupId]) {
            if (slot.slotId == slotId) {
                fSlot = slot;
                break;
            }
        }
        if (fSlot) break;
    }

    if (!fSlot) return res.status(404).json({ error: "Slot not found." });

    res.json(fSlot);
});

//Enter (or modify if exists) a grade
router.post('/enter', [
    body('memberId').isString().withMessage('Member ID must be a string').customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, '')),
    body('signupId').isInt().withMessage('Signup ID must be a number').toInt(),
    body('grade').isInt({ min: 0, max: 999 }).withMessage('Grade must be a number between 0 and 999').toInt(),
    body('comment').optional().isString().customSanitizer(value => value.replace(/[^\p{L}\p{N} \-']/gu, ''))
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { memberId, signupId, grade, comment } = req.body;

    if (!memberId || !signupId) return res.status(400).json({ error: "memberId and signupId are required." });

    const slotList = slots[String(signupId)];
    if (!slotList) return res.status(404).json({ error: "Signup ID not found." });

    let memberFound = false;
    for (const s of slotList) {
        if (s.members.includes(memberId)) {
            memberFound = true;
            break;
        }
    }

    if (!memberFound) return res.status(404).json({ error: "Member not found under this signup ID." });

    const existing = grades.find(g => g.memberId == memberId && g.signupId == signupId);

    if (existing) {
        const oldGrade = existing.grade;
        if (comment) existing.comment = (existing.comment || "") + " " + comment;
        existing.grade = grade;
        fs.writeFileSync("data/grades.json", JSON.stringify(grades, null, 2));
        return res.json({ message: "Grade updated.", oldGrade, updated: existing });
    }

    const newGrade = {
        memberId,
        signupId,
        grade,
        comment: comment || ""
    };

    grades.push(newGrade);
    fs.writeFileSync("data/grades.json", JSON.stringify(grades, null, 2));

    res.status(201).json({ message: "Grade added.", grade: newGrade });
});

module.exports = router;
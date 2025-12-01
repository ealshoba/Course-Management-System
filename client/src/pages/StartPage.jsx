import React, { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./StartPage.module.css";

export default function StartPage() {

    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [expanded, setExpanded] = useState({});

    const API_SIGNUPS = "/api/signups";
    const API_SLOTS = "/api/slots";
    const API_COURSES = "/api/courses";

    // Search for signup sheets by course code
    const handleSearch = async () => {
        const term = search.replace(/\s+/g, "").toLowerCase();
        if (!term) return setResults([]);

        try {
            // Get all courses
            const res = await fetch(API_COURSES);
            const allCourses = await res.json();

            const matched = allCourses.filter(c =>
                String(c.termCode).replace(/\s+/g, "").toLowerCase().includes(term)
            );

            let collected = [];

            // For each matched course, fetch its signup sheets
            for (const course of matched) {
                const r = await fetch(`${API_SIGNUPS}/${course.termCode}?section=${course.section}`);
                const sheets = await r.json();

                collected.push({
                    course,
                    sheets: Array.isArray(sheets) ? sheets : []
                });
            }

            setResults(collected);

        } catch (err) {
            console.error("Search error:", err);
        }
    };

    // Expand a signup sheet, get slots
    const toggleExpand = async (signupId) => {
        const isOpen = expanded[signupId];

        // collapse
        if (isOpen) {
            setExpanded(prev => ({ ...prev, [signupId]: null }));
            return;
        }

        // expand, fetch slots
        try {
            const res = await fetch(`${API_SLOTS}/${signupId}`);
            const slots = await res.json();

            setExpanded(prev => ({ ...prev, [signupId]: slots }));
        } catch (err) {
            console.error("Slot load error:", err);
        }
    };

    return (
        <div className={styles.startPage}>
            <h1 className={styles.title}>Course Management System</h1>

            <div className={styles.container}>
                <h1 className={styles.title}>About</h1>
                <p className={styles.description}>
                    A platform for managing course registrations and grades, allowing users to sign up for available slots, track progress, and view detailed assignment information.
                </p>
                <br />

                <Link to="/login">
                    <button className={styles.loginButton}>Login</button>
                </Link>
            </div>
            <br /><br />
            <div className={styles.startPageSearch}>
                {/* Search Box */}
                <h3>Search Course</h3>
                <input
                    type="text"
                    placeholder="Search course code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={styles.searchBox}
                /><br />
                <button onClick={handleSearch} className={styles.searchButton}>
                    Search
                </button>
            </div>


            {/* Results */}
            <div className={styles.results}>
                {results.map(({ course, sheets }) => (
                    <div key={`${course.termCode}-${course.section}`} className={styles.courseBlock}>
                        <h2>
                            Course {course.termCode} — Section {course.section}
                        </h2>

                        {sheets.length === 0 ? (
                            <p>No sign-up sheets found.</p>
                        ) : (
                            sheets.map(sheet => (
                                <div key={sheet.signupId} className={styles.sheetItem}>
                                    <div
                                        className={styles.sheetHeader}
                                        onClick={() => toggleExpand(sheet.signupId)}
                                    >
                                        <strong>{sheet.assignmentName}</strong><br />
                                        Not Before: {sheet.notBefore}<br />
                                        Not After: {sheet.notAfter}<br />
                                        <em>(click to {expanded[sheet.signupId] ? "collapse" : "expand"})</em>
                                    </div>

                                    {/* Slots */}
                                    {expanded[sheet.signupId] && (
                                        <ul className={styles.slotList}>
                                            {expanded[sheet.signupId].map(slot => (
                                                <li key={slot.slotId} className={styles.slotItem}>
                                                    Slot ID: {slot.slotId}<br />
                                                    Start: {slot.start}<br />
                                                    Duration: {slot.duration} min<br />
                                                    Capacity: {slot.maxMembers}<br />
                                                    Signed Up: {slot.members.length}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
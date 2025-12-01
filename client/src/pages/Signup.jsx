import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import styles from "./Signup.module.css";

export default function Signup() {
    const API_URL = "/api/signups";
    const COURSES_API = "/api/courses";
    const navigate = useNavigate();

    const [createData, setCreateData] = useState({
        termCode: "",
        section: 1,
        assignmentName: "",
        notBefore: "",
        notAfter: "",
    });

    const [filterData, setFilterData] = useState({
        termCode: "",
        section: 1,
    });

    const [signups, setSignups] = useState([]);
    const [courses, setCourses] = useState([]);
    const token = localStorage.getItem("token");

    const headersWithAuth = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    // Authorization check
    const checkAuthAndRole = () => {
        if (!token) {
            alert("Please log in first.");
            navigate("/login");
            return false;
        }

        let decoded;
        try {
            decoded = jwtDecode(token);
        } catch {
            alert("Invalid session. Please log in again.");
            navigate("/home");
            return false;
        }

        if (decoded.mustChangePassword) {
            alert("You must change your password before continuing.");
            navigate("/change-password");
            return false;
        }

        if (decoded.role !== "ta" && decoded.role !== "admin") {
            alert("You do not have permission to access this page.");
            navigate("/home");
            return false;
        }

        return true;
    };

    useEffect(() => {
        if (checkAuthAndRole()) {
            loadCourses();
        }
    }, []);

    // Load courses
    const loadCourses = async () => {
        try {
            const res = await fetch(COURSES_API, { headers: headersWithAuth });
            const data = await res.json();
            setCourses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            setCourses([]);
        }
    };

    // Load signups
    const loadSignups = async (termCode, section = 1) => {
        setSignups("Loading...");

        try {
            const res = await fetch(`${API_URL}/${termCode}?section=${section}`, {
                headers: headersWithAuth,
            });
            const data = await res.json();

            if (data.errors) {
                setSignups([{ error: "Validation Errors:\n" + data.errors.join("\n") }]);
                return;
            }

            setSignups(Array.isArray(data) ? data : []);
        } catch {
            setSignups([{ error: "Error connecting to server." }]);
        }
    };

    // Create signup sheet
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createData.termCode) return alert("Select a course.");

        const body = {
            termCode: parseInt(createData.termCode),
            section: parseInt(createData.section),
            assignmentName: createData.assignmentName,
            notBefore: createData.notBefore.replace("T", " "),
            notAfter: createData.notAfter.replace("T", " "),
        };

        try {
            const res = await fetch(`${API_URL}/create`, {
                method: "POST",
                headers: headersWithAuth,
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (data.errors) return alert("Validation Errors:\n" + data.errors.join("\n"));
            if (data.error) return alert("Error: " + data.error);

            setCreateData({ termCode: "", section: 1, assignmentName: "", notBefore: "", notAfter: "" });
            loadSignups(body.termCode, body.section);
        } catch {
            alert("Error connecting to server.");
        }
    };

    // Delete signup sheet
    const deleteSignup = async (signupId, termCode, section) => {
        if (!window.confirm(`Delete signup sheet ID ${signupId}?`)) return;

        try {
            const res = await fetch(`${API_URL}/delete`, {
                method: "DELETE",
                headers: headersWithAuth,
                body: JSON.stringify({ signupId }),
            });
            const data = await res.json();

            if (data.errors) return alert("Validation Errors:\n" + data.errors.join("\n"));
            if (data.error) return alert("Error: " + data.error);

            loadSignups(termCode, section);
        } catch {
            alert("Error connecting to server.");
        }
    };

    // Filter form
    const handleFilter = (e) => {
        e.preventDefault();
        if (!filterData.termCode) return alert("Select a course.");
        loadSignups(filterData.termCode, filterData.section || 1);
    };

    return (
        <div className={styles.SignUpContainer}>
            <Link className={styles.back} to="/home">&lt;&nbsp;Back</Link>
            <h1 className={styles.title}>Manage Signup Sheets</h1>

            {/* CREATE SIGNUP */}
            <section className={styles.box}>
                <h2>Create Signup Sheet</h2>
                <form className={styles.form} onSubmit={handleCreate}>
                    <label>
                        Select Course:
                        <select
                            value={createData.termCode + "-" + createData.section}
                            onChange={(e) => {
                                const [term, sec] = e.target.value.split("-");
                                setCreateData({ ...createData, termCode: term, section: sec });
                            }}
                            required
                        >
                            <option value="">-- Select Course --</option>
                            {courses.map((c, idx) => (
                                <option key={idx} value={`${c.termCode}-${c.section}`}>
                                    Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Assignment Name:
                        <input
                            type="text"
                            value={createData.assignmentName}
                            maxLength={100}
                            onChange={(e) => setCreateData({ ...createData, assignmentName: e.target.value })}
                            required
                        />
                    </label>

                    <label>
                        Not Before:
                        <input
                            type="datetime-local"
                            value={createData.notBefore}
                            onChange={(e) => setCreateData({ ...createData, notBefore: e.target.value })}
                            required
                        />
                    </label>

                    <label>
                        Not After:
                        <input
                            type="datetime-local"
                            value={createData.notAfter}
                            onChange={(e) => setCreateData({ ...createData, notAfter: e.target.value })}
                            required
                        />
                    </label>

                    <button type="submit">Add Signup Sheet</button>
                </form>
            </section>

            {/* LIST SIGNUPS */}
            <section className={styles.box}>
                <h2>Signup Sheets</h2>
                <form className={styles.form} onSubmit={handleFilter}>
                    <label>
                        Select Course:
                        <select
                            value={filterData.termCode + "-" + filterData.section}
                            onChange={(e) => {
                                const [term, sec] = e.target.value.split("-");
                                setFilterData({ ...filterData, termCode: term, section: sec });
                            }}
                            required
                        >
                            <option value="">-- Select Course --</option>
                            {courses.map((c, idx) => (
                                <option key={idx} value={`${c.termCode}-${c.section}`}>
                                    Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="submit">Load</button>
                </form>

                <ul className={styles.list}>
                    {Array.isArray(signups) ? (
                        signups.length === 0 ? (
                            <li>No signup sheets found.</li>
                        ) : (
                            signups.map((s) => (
                                <li key={s.signupId}>
                                    #{s.signupId}: {s.assignmentName} ({s.notBefore} → {s.notAfter})
                                    <button
                                        onClick={() =>
                                            deleteSignup(s.signupId, filterData.termCode, filterData.section)
                                        }
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))
                        )
                    ) : (
                        <li>{signups}</li>
                    )}
                </ul>
            </section>
        </div>
    );
}
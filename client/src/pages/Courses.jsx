import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Courses.module.css";
import { jwtDecode } from "jwt-decode";

export default function Courses() {
    const [courses, setCourses] = useState([]);
    const [newCourse, setNewCourse] = useState({ termCode: "", courseName: "", section: 1 });
    const [modCourse, setModCourse] = useState({
        termCode: "",
        section: 1,
        courseName: "",
        newSection: "",
    });

    const API_URL = "/api/courses";
    const navigate = useNavigate();

    const checkAuthAndRole = () => {
        const token = localStorage.getItem("token");
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

        // Must change password
        if (decoded.mustChangePassword) {
            alert("You must change your password before continuing.");
            navigate("/change-password");
            return false;
        }

        // Role check
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

    const getToken = () => localStorage.getItem("token");

    const loadCourses = async () => {
        try {
            const token = getToken();
            if (!token) {
                alert("Please log in first.");
                navigate("/login");
                return;
            }

            const res = await fetch(API_URL, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();
            setCourses(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const token = getToken();
            const res = await fetch(`${API_URL}/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    termCode: parseInt(newCourse.termCode),
                    courseName: newCourse.courseName,
                    section: parseInt(newCourse.section),
                }),
            });

            const data = await res.json();
            if (data.error || data.errors) {
                alert(data.error || data.errors.join("\n"));
            } else {
                setNewCourse({ termCode: "", courseName: "", section: 1 });
                loadCourses();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleModify = async (e) => {
        e.preventDefault();
        try {
            const token = getToken();
            const body = {
                termCode: parseInt(modCourse.termCode),
                section: parseInt(modCourse.section),
            };
            if (modCourse.courseName.trim()) body.courseName = modCourse.courseName;
            if (modCourse.newSection.trim()) body.newSection = parseInt(modCourse.newSection);

            const res = await fetch(`${API_URL}/modify`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (data.error || data.errors) {
                alert(data.error || data.errors.join("\n"));
            } else {
                setModCourse({ termCode: "", section: "", courseName: "", newSection: "" });
                loadCourses();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (termCode, section) => {
        if (!window.confirm(`Delete course Term: ${termCode}, Section: ${section}?`)) return;
        try {
            const token = getToken();
            const res = await fetch(`${API_URL}/delete`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ termCode, section }),
            });

            const data = await res.json();
            if (data.error || data.errors) {
                alert(data.error || data.errors.join("\n"));
            } else {
                loadCourses();
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className={styles.coursesContainer}>
            <Link className={styles.back} to="/home">&lt;&nbsp;Back</Link>
            <h1 className={styles.title}>Manage Courses</h1>

            <section className={styles.createCourse}>
                <h2>Create Course</h2><br />
                <form onSubmit={handleCreate}>
                    <label>
                        Term Code:
                        <input
                            type="number"
                            value={newCourse.termCode}
                            onChange={(e) => setNewCourse({ ...newCourse, termCode: e.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Course Name:
                        <input
                            type="text"
                            maxLength="100"
                            value={newCourse.courseName}
                            onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })}
                            required
                        />
                    </label>
                    <label>
                        Section:
                        <input
                            type="number"
                            value={newCourse.section}
                            onChange={(e) => setNewCourse({ ...newCourse, section: e.target.value })}
                            required
                        />
                    </label>
                    <button type="submit">Add Course</button>
                </form>
            </section><br />

            <section className={styles.modifyCourse}>
                <h2>Modify Course</h2><br />
                <form onSubmit={handleModify}>
                    <label>
                        Select Course:
                        <select
                            value={modCourse.selectedCourse || ""}
                            onChange={(e) => {
                                const selectedIndex = e.target.value;
                                if (selectedIndex === "") {
                                    setModCourse({
                                        termCode: "",
                                        section: "",
                                        courseName: "",
                                        newSection: "",
                                        selectedCourse: "",
                                    });
                                } else {
                                    const course = courses[selectedIndex];
                                    setModCourse({
                                        termCode: course.termCode,
                                        section: course.section,
                                        courseName: "",
                                        newSection: "",
                                        selectedCourse: selectedIndex,
                                    });
                                }
                            }}
                            required
                        >
                            <option value="">-- Select a course --</option>
                            {courses.map((course, index) => (
                                <option key={index} value={index}>
                                    Term: {course.termCode}, Name: {course.courseName}, Section: {course.section}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        New Course Name:
                        <input
                            type="text"
                            value={modCourse.courseName}
                            onChange={(e) => setModCourse({ ...modCourse, courseName: e.target.value })}
                        />
                    </label>
                    <label>
                        New Section:
                        <input
                            type="number"
                            value={modCourse.newSection}
                            onChange={(e) => setModCourse({ ...modCourse, newSection: e.target.value })}
                        />
                    </label>
                    <button type="submit">Modify Course</button>
                </form>
            </section><br />

            <section className={styles.courseList}>
                <h2>Existing Courses</h2><br />
                <ul>
                    {courses.map((course, i) => (
                        <li key={i}>
                            Term: {course.termCode}, Name: {course.courseName}, Section: {course.section}
                            <button onClick={() => handleDelete(course.termCode, course.section)}>Delete</button>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
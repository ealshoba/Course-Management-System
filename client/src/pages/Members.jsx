import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import styles from "./Members.module.css";

export default function Members() {
    const [courses, setCourses] = useState([]);
    const [addCourse, setAddCourse] = useState("");
    const [deleteCourse, setDeleteCourse] = useState("");
    const [getCourse, setGetCourse] = useState("");

    const [addData, setAddData] = useState({
        lastName: "",
        firstName: "",
        email: "",
        password: "",
        bulkText: "",
    });

    const [deleteData, setDeleteData] = useState({
        memberIds: "",
    });

    const [getResult, setGetResult] = useState([]);
    const [addResult, setAddResult] = useState("");
    const [bulkResult, setBulkResult] = useState("");
    const [deleteResult, setDeleteResult] = useState("");

    // Admin-only state
    const [taData, setTaData] = useState({ memberId: "", action: "add" });
    const [passwordData, setPasswordData] = useState({ memberId: "", newPassword: "" });
    const [taResult, setTaResult] = useState("");
    const [passwordResult, setPasswordResult] = useState("");

    const navigate = useNavigate();
    const API_URL = "/api/courses";

    const getToken = () => localStorage.getItem("token");

    // Decode user role
    const token = getToken();
    let userRole = "";
    try {
        const decoded = jwtDecode(token);
        userRole = decoded.role;
    } catch {
        userRole = "";
    }
    const isAdmin = userRole === "admin";

    // Auth check
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

    // Load courses
    const loadCourses = async () => {
        try {
            const token = getToken();

            const res = await fetch("/api/courses", {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            setCourses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load courses", err);
            setCourses([]);
        }
    };

    useEffect(() => {
        if (checkAuthAndRole()) loadCourses();
    }, []);

    // CSV file handler
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            setAddData({ ...addData, bulkText: evt.target.result });
            e.target.value = "";
        };
        reader.readAsText(file);
    };

    // Add single member
    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!addCourse) return alert("Select a course.");

        const [termCode, section] = addCourse.split("-");
        const token = getToken();

        if (!addData.email || !addData.password) {
            return alert("Email and password are required.");
        }

        try {
            const res = await fetch(`${API_URL}/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    termCode,
                    section,
                    members: [
                        {
                            lastName: addData.lastName,
                            firstName: addData.firstName,
                            email: addData.email,
                            password: addData.password,
                        },
                    ],
                }),
            });

            const data = await res.json();

            if (data.error || data.errors) {
                setAddResult(data.error || data.errors.join("\n"));
            } else {
                setAddResult(
                    `Added: ${data.addedCount} | Ignored: ${data.ignored?.length ? data.ignored.join(", ") : "None"
                    }`
                );
                setAddData({
                    lastName: "",
                    firstName: "",
                    email: "",
                    password: "",
                    bulkText: "",
                });
                loadCourses();
            }
        } catch {
            setAddResult("Error connecting to server.");
        }
    };

    // Bulk add members
    const handleAddBulk = async (e) => {
        e.preventDefault();
        if (!addCourse) return alert("Select a course.");

        const [termCode, section] = addCourse.split("-");
        const token = getToken();

        const text = addData.bulkText.trim();
        if (!text) return alert("CSV is empty.");

        const lines = text.split("\n");
        const members = [];

        for (const line of lines) {
            const parts = line.split(",").map((s) => s.trim());
            if (parts.length === 4) {
                members.push({
                    lastName: parts[0],
                    firstName: parts[1],
                    email: parts[2],
                    password: parts[3],
                });
            }
        }

        try {
            const res = await fetch(`${API_URL}/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ termCode, section, members }),
            });

            const data = await res.json();

            if (data.error || data.errors) {
                setBulkResult(data.error || data.errors.join("\n"));
            } else {
                setBulkResult(
                    `Added: ${data.addedCount} | Ignored: ${data.ignored?.length ? data.ignored.join(", ") : "None"
                    }`
                );
                setAddData({ lastName: "", firstName: "", email: "", password: "", bulkText: "" });
                loadCourses();
            }
        } catch {
            setBulkResult("Error connecting to server.");
        }
    };

    // Delete member
    const handleDeleteMember = async (e) => {
        e.preventDefault();
        if (!deleteCourse) return alert("Select a course.");
        const [termCode, section] = deleteCourse.split("-");

        if (!deleteData.memberIds.trim()) return alert("Enter at least one member ID.");

        const token = getToken();

        try {
            const res = await fetch(`${API_URL}/deleteMembers`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    termCode,
                    section,
                    memberIds: deleteData.memberIds
                        .split(",")
                        .map(id => id.trim())
                        .filter(id => id.length > 0),
                }),
            });

            const data = await res.json();

            if (data.error || data.errors) {
                setDeleteResult(data.error || data.errors.join("\n"));
            } else {
                setDeleteResult("Member(s) deleted successfully!");
                setDeleteData({ memberIds: "" });
                loadCourses();
            }
        } catch {
            setDeleteResult("Error connecting to server.");
        }
    };

    // Get members
    const handleGetMembers = async () => {
        if (!getCourse) return alert("Select a course.");
        const [termCode, section] = getCourse.split("-");

        const token = getToken();

        try {
            const res = await fetch(`${API_URL}/${termCode}/${section}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();
            setGetResult(Array.isArray(data) ? data : []);
        } catch {
            setGetResult([]);
        }
    };

    // Add TA
    const handleAddTA = async (e) => {
        e.preventDefault();
        if (!addData.firstName || !addData.lastName || !addData.email) return alert("Fill in all fields.");

        const [termCode, section] = addCourse.split("-");
        const token = getToken();

        try {
            const res = await fetch("/api/courses/addTA", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    termCode: parseInt(termCode),
                    section: section ? parseInt(section) : 1,
                    firstName: addData.firstName,
                    lastName: addData.lastName,
                    email: addData.email,
                    password: addData.password || undefined
                })
            });
            const data = await res.json();
            setTaResult(data.error || data.errors?.join(", ") || data.message);
        } catch {
            setTaResult("Error connecting to server.");
        }
    };

    // Remove TA
    const handleRemoveTA = async (e) => {
        e.preventDefault();
        if (!taData.memberId) return alert("Enter member ID.");

        const [termCode, section] = addCourse.split("-");
        const token = getToken();

        try {
            const res = await fetch("/api/courses/removeTA", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    termCode: parseInt(termCode),
                    section: section ? parseInt(section) : 1,
                    memberId: taData.memberId
                })
            });
            const data = await res.json();
            setTaResult(data.error || data.errors?.join(", ") || data.message);
        } catch {
            setTaResult("Error connecting to server.");
        }
    };

    // Reset Password
    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!passwordData.memberId || !passwordData.newPassword) return alert("Fill in all fields.");

        const token = getToken();

        try {
            const res = await fetch("/api/courses/resetPassword", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    memberId: passwordData.memberId,
                    newPassword: passwordData.newPassword
                })
            });
            const data = await res.json();
            setPasswordResult(data.error || data.errors?.join(", ") || data.message);
        } catch {
            setPasswordResult("Error connecting to server.");
        }
    };

    const handleTAChange = async (e) => {
        e.preventDefault();
        if (!taData.memberId && taData.action === "remove") return alert("Enter member ID.");
        if (!addCourse) return alert("Select a course.");

        const [termCode, section] = addCourse.split("-");
        const token = getToken();

        try {
            let res;
            if (taData.action === "add") {
                if (!addData.firstName || !addData.lastName || !addData.email)
                    return alert("Fill in all fields for adding TA.");

                res = await fetch("/api/courses/addTA", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        termCode: parseInt(termCode),
                        section: section ? parseInt(section) : 1,
                        firstName: addData.firstName,
                        lastName: addData.lastName,
                        email: addData.email,
                        password: addData.password || undefined
                    })
                });
            } else if (taData.action === "remove") {
                res = await fetch("/api/courses/removeTA", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        termCode: parseInt(termCode),
                        section: section ? parseInt(section) : 1,
                        memberId: taData.memberId
                    })
                });
            }

            const data = await res.json();
            setTaResult(data.error || data.errors?.join(", ") || data.message);

            // Optionally refresh courses after change
            loadCourses();
        } catch {
            setTaResult("Error connecting to server.");
        }
    };



    return (
        <div className={styles.MemContainer}>
            <Link className={styles.back} to="/home">&lt;&nbsp;Back</Link>
            <h1 className={styles.title}>Manage Course Members</h1>

            {/* Add Member */}
            <form className={styles.form} onSubmit={handleAddMember}>
                <h2>Add Member</h2>
                <label>
                    Select Course:
                    <select value={addCourse} onChange={(e) => setAddCourse(e.target.value)}>
                        <option value="">-- Select Course --</option>
                        {courses.map((c, idx) => (
                            <option key={idx} value={`${c.termCode}-${c.section}`}>
                                Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                            </option>
                        ))}
                    </select>
                </label>

                <label>Last Name:
                    <input type="text" value={addData.lastName}
                        onChange={(e) => setAddData({ ...addData, lastName: e.target.value })} required />
                </label>

                <label>First Name:
                    <input type="text" value={addData.firstName}
                        onChange={(e) => setAddData({ ...addData, firstName: e.target.value })} required />
                </label>

                <label>Email:
                    <input type="email" value={addData.email}
                        onChange={(e) => setAddData({ ...addData, email: e.target.value })} required />
                </label>

                <label>Password:
                    <input type="password" value={addData.password}
                        onChange={(e) => setAddData({ ...addData, password: e.target.value })} required />
                </label>

                <button type="submit">Add Member</button>
                <div className={styles.resultBox}>{addResult}</div>
            </form>

            {/* Bulk Add */}
            <form className={styles.form} onSubmit={handleAddBulk}>
                <h2>Bulk Add Members (CSV)</h2>

                <label>
                    Select Course:
                    <select value={addCourse} onChange={(e) => setAddCourse(e.target.value)}>
                        <option value="">-- Select Course --</option>
                        {courses.map((c, idx) => (
                            <option key={idx} value={`${c.termCode}-${c.section}`}>
                                Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                            </option>
                        ))}
                    </select>
                </label>

                <input type="file" accept=".csv" onChange={handleFileUpload} />

                <textarea
                    rows="5"
                    placeholder="last-name, first-name, email, password"
                    value={addData.bulkText}
                    onChange={(e) => setAddData({ ...addData, bulkText: e.target.value })}
                />

                <button type="submit">Add Bulk Members</button>

                <div className={styles.resultBox}>{bulkResult}</div>
            </form>

            {/* Delete Member */}
            <form className={styles.form} onSubmit={handleDeleteMember}>
                <h2>Delete Member</h2>

                <label>
                    Select Course:
                    <select value={deleteCourse} onChange={(e) => setDeleteCourse(e.target.value)}>
                        <option value="">-- Select Course --</option>
                        {courses.map((c, idx) => (
                            <option key={idx} value={`${c.termCode}-${c.section}`}>
                                Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                            </option>
                        ))}
                    </select>
                </label>

                <label>Member IDs (comma separated):
                    <input
                        type="text"
                        value={deleteData.memberIds}
                        onChange={(e) => setDeleteData({ memberIds: e.target.value })}
                        placeholder="M0000001, M0000002, ..."
                    />
                </label>

                <button type="submit">Delete Member</button>
                <div className={styles.resultBox}>{deleteResult}</div>
            </form>

            {/* Get Members */}
            <div className={styles.form}>
                <h2>Existing Members</h2>

                <label>
                    Select Course:
                    <select value={getCourse} onChange={(e) => setGetCourse(e.target.value)}>
                        <option value="">-- Select Course --</option>
                        {courses.map((c, idx) => (
                            <option key={idx} value={`${c.termCode}-${c.section}`}>
                                Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                            </option>
                        ))}
                    </select>
                </label>

                <button onClick={handleGetMembers}>Load Members</button>

                <ul className={styles.list}>
                    {Array.isArray(getResult) && getResult.length > 0 ? (
                        getResult.map((m, i) => (
                            <li key={i} className={styles.memberCard}>
                                <p><strong>ID:</strong> {m.memberId}</p>
                                <p><strong>Name:</strong> {m.firstName} {m.lastName}</p>
                                <p><strong>Email:</strong> {m.email}</p>
                                <p><strong>Role:</strong> {m.role}</p>
                            </li>
                        ))
                    ) : (
                        <li>No members found</li>
                    )}
                </ul>
            </div>


            {/* Admin-only Forms */}
            {isAdmin && (
                <>
                    {/* Add/Remove TA */}
                    <form className={styles.form} onSubmit={handleTAChange}>
                        <h2>Manage TA Role</h2>

                        <label>
                            Select Course:
                            <select value={addCourse} onChange={(e) => setAddCourse(e.target.value)}>
                                <option value="">-- Select Course --</option>
                                {courses.map((c, idx) => (
                                    <option key={idx} value={`${c.termCode}-${c.section}`}>
                                        Term: {c.termCode}, Section: {c.section}, Name: {c.courseName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Action:
                            <select
                                value={taData.action}
                                onChange={(e) => setTaData({ ...taData, action: e.target.value })}
                            >
                                <option value="add">Add as TA</option>
                                <option value="remove">Remove TA</option>
                            </select>
                        </label>

                        {taData.action === "add" && (
                            <>
                                <label>
                                    First Name:
                                    <input
                                        type="text"
                                        value={addData.firstName}
                                        onChange={(e) => setAddData({ ...addData, firstName: e.target.value })}
                                        required
                                    />
                                </label>

                                <label>
                                    Last Name:
                                    <input
                                        type="text"
                                        value={addData.lastName}
                                        onChange={(e) => setAddData({ ...addData, lastName: e.target.value })}
                                        required
                                    />
                                </label>

                                <label>
                                    Email:
                                    <input
                                        type="email"
                                        value={addData.email}
                                        onChange={(e) => setAddData({ ...addData, email: e.target.value })}
                                        required
                                    />
                                </label>

                                <label>
                                    Password:
                                    <input
                                        type="password"
                                        value={addData.password}
                                        onChange={(e) => setAddData({ ...addData, password: e.target.value })}
                                        placeholder="Required if new user"
                                    />
                                </label>
                            </>
                        )}

                        {taData.action === "remove" && (
                            <label>
                                Member ID:
                                <input
                                    type="text"
                                    value={taData.memberId}
                                    onChange={(e) => setTaData({ ...taData, memberId: e.target.value })}
                                    placeholder="M0000001"
                                    required
                                />
                            </label>
                        )}

                        <button type="submit">Update Role</button>
                        <div className={styles.resultBox}>{taResult}</div>
                    </form>

                    {/* Reset Password */}
                    <form className={styles.form} onSubmit={handleResetPassword}>
                        <h2>Reset Member Password</h2>
                        <label>
                            Member ID:
                            <input
                                type="text"
                                value={passwordData.memberId}
                                onChange={(e) => setPasswordData({ ...passwordData, memberId: e.target.value })}
                                placeholder="M0000001"
                            />
                        </label>
                        <label>
                            New Password:
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            />
                        </label>
                        <button type="submit">Reset Password</button>
                        <div className={styles.resultBox}>{passwordResult}</div>
                    </form>
                </>
            )}
        </div>
    );
}
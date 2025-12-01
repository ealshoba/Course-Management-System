import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import styles from "./Slot.module.css";

export default function Slots() {
    const COURSES_URL = "/api/courses";
    const SIGNUPS_URL = "/api/signups";
    const API_URL = "/api/slots";

    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const toInputDateTime = (str) => {
        if (!str) return "";
        const t = str.replace(" ", "T");
        return t.length === 16 ? t + ":00" : t;
    };
    const toBackendDateTime = (str) => str?.replace("T", " ");

    const [courses, setCourses] = useState([]);
    const [signupSheets, setSignupSheets] = useState([]);
    const [slots, setSlots] = useState({});

    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedSection, setSelectedSection] = useState("");

    const [addData, setAddData] = useState({
        signupId: "",
        start: "",
        slotDuration: "",
        numSlots: "",
        maxMembers: "",
    });

    const [modData, setModData] = useState({
        slotId: "",
        start: "",
        duration: "",
        maxMembers: "",
    });

    const [viewSignupId, setViewSignupId] = useState("");

    // AUTH + load courses
    useEffect(() => {
        if (!token) return navigate("/login");

        try {
            const decoded = jwtDecode(token);
            if (!["admin", "ta"].includes(decoded.role)) {
                alert("You do not have permission to access this page.");
                return navigate("/home");
            }
            if (decoded.mustChangePassword) {
                alert("Change password first");
                return navigate("/change-password");
            }

            loadCourses();
        } catch (err) {
            console.error(err);
            navigate("/login");
        }
    }, []);

    const loadCourses = async () => {
        try {
            const res = await fetch(COURSES_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setCourses(data);
        } catch (err) {
            alert("Error loading courses: " + err.message);
        }
    };

    // Load signup sheets when course changes
    useEffect(() => {
        if (!selectedCourse || !selectedSection) return;

        fetch(`${SIGNUPS_URL}/${selectedCourse}?section=${selectedSection}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setSignupSheets(data);
                setAddData((prev) => ({ ...prev, signupId: "" }));
                setViewSignupId("");
            })
            .catch((err) => alert("Error loading signups: " + err.message));
    }, [selectedCourse, selectedSection]);

    const loadSlots = async (signupId) => {
        if (!signupId) return;
        try {
            const res = await fetch(`${API_URL}/signupId/${signupId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setSlots((prev) => ({
                ...prev,
                [signupId]: data.length ? data : [{ empty: true }],
            }));
        } catch (err) {
            setSlots((prev) => ({
                ...prev,
                [signupId]: [{ error: "Error loading slots: " + err.message }],
            }));
        }
    };

    const formatDate = (val) => (val ? val.replace("T", " ") : null);

    // ADD SLOTS
    const handleAdd = async (e) => {
        e.preventDefault();
        const payload = {
            signupId: parseInt(addData.signupId),
            start: formatDate(addData.start),
            slotDuration: parseInt(addData.slotDuration),
            numSlots: parseInt(addData.numSlots),
            maxMembers: parseInt(addData.maxMembers),
        };

        try {
            const res = await fetch(`${API_URL}/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.errors) return alert(data.errors.map((e) => e.msg).join("\n"));
            if (data.error) return alert(data.error);

            alert(`Added ${data.added.length} slots.`);
            setAddData({ signupId: "", start: "", slotDuration: "", numSlots: "", maxMembers: "" });
            loadSlots(payload.signupId);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    // MODIFY SLOT
    const handleModify = async (e) => {
        e.preventDefault();

        const payload = { slotId: parseInt(modData.slotId) };
        if (modData.start) payload.start = formatDate(modData.start);
        if (modData.duration) payload.duration = parseInt(modData.duration);
        if (modData.maxMembers) payload.maxMembers = parseInt(modData.maxMembers);

        try {
            const res = await fetch(`${API_URL}/modify`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.errors) return alert(data.errors.map((e) => e.msg).join("\n"));
            if (data.error) return alert(data.error);

            alert(data.message);
            setModData({ slotId: "", start: "", duration: "", maxMembers: "" });
            loadSlots(viewSignupId);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    // DELETE SLOT
    const handleDelete = async (slotId) => {
        if (!window.confirm(`Delete slot ID ${slotId}?`)) return;

        try {
            const res = await fetch(`${API_URL}/delete`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ slotId }),
            });

            const data = await res.json();
            if (data.errors) return alert(data.errors.map((e) => e.msg).join("\n"));
            if (data.error) return alert(data.error);

            loadSlots(viewSignupId);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleView = (e) => {
        e.preventDefault();
        loadSlots(viewSignupId);
    };

    return (
        <div className={styles.SlotContainer}>
            <Link className={styles.back} to="/home">&lt; Back</Link>
            <h1 className={styles.title}>Manage Slots</h1>

            {/* COURSE SELECTION */}
            <section className={styles.section}>
                <h2>Select Course</h2>
                <label>
                    Course:
                    <select
                        value={`${selectedCourse}-${selectedSection}`}
                        onChange={(e) => {
                            const [termCode, section] = e.target.value.split("-");
                            setSelectedCourse(termCode);
                            setSelectedSection(section);
                        }}
                    >
                        <option value="">Select course</option>
                        {courses.map((c) => (
                            <option key={`${c.termCode}-${c.section}`} value={`${c.termCode}-${c.section}`}>
                                {c.courseName} (Term {c.termCode}, Sec {c.section})
                            </option>
                        ))}
                    </select>
                </label>
            </section><br/>

            {/* ADD SLOTS */}
            <section className={styles.section}>
                <h2>Add Slots</h2>
                <form onSubmit={handleAdd}>
                    <label>
                        Signup Sheet:
                        <select
                            value={addData.signupId}
                            onChange={(e) => setAddData({ ...addData, signupId: e.target.value })}
                            required
                        >
                            <option value="">Select signup sheet</option>
                            {signupSheets.map((sheet) => (
                                <option key={sheet.signupId} value={sheet.signupId}>
                                    {sheet.signupId} - {sheet.assignmentName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Start Time:
                        <input
                            type="datetime-local"
                            value={toInputDateTime(addData.start)}
                            onChange={(e) => setAddData({ ...addData, start: e.target.value })}
                            required
                        />
                    </label>

                    <label>
                        Slot Duration:
                        <input
                            type="number"
                            value={addData.slotDuration}
                            onChange={(e) => setAddData({ ...addData, slotDuration: e.target.value })}
                            required
                        />
                    </label>

                    <label>
                        Number of Slots:
                        <input
                            type="number"
                            value={addData.numSlots}
                            onChange={(e) => setAddData({ ...addData, numSlots: e.target.value })}
                            required
                        />
                    </label>

                    <label>
                        Max Members:
                        <input
                            type="number"
                            value={addData.maxMembers}
                            onChange={(e) => setAddData({ ...addData, maxMembers: e.target.value })}
                            required
                        />
                    </label>

                    <button type="submit">Add Slots</button>
                </form>
            </section><br/>

            {/* MODIFY SLOT */}
            <section className={styles.section}>
                <h2>Modify Slot</h2>
                <form onSubmit={handleModify}>
                    <label>
                        Slot ID:
                        <select
                            value={modData.slotId}
                            onChange={(e) => {
                                const slot = (slots[viewSignupId] || []).find(
                                    (s) => s.slotId === parseInt(e.target.value)
                                );
                                setModData({
                                    slotId: e.target.value,
                                    start: toInputDateTime(slot?.start || ""),
                                    duration: slot?.duration || "",
                                    maxMembers: slot?.maxMembers || "",
                                });
                            }}
                            required
                        >
                            <option value="">Select slot</option>
                            {(slots[viewSignupId] || []).map((slot) =>
                                slot.error || slot.empty ? null : (
                                    <option key={slot.slotId} value={slot.slotId}>
                                        {slot.slotId} - {toInputDateTime(slot.start)}
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        Start Time:
                        <input
                            type="datetime-local"
                            value={toInputDateTime(modData.start)}
                            onChange={(e) => setModData({ ...modData, start: e.target.value })}
                        />
                    </label>

                    <label>
                        Duration:
                        <input
                            type="number"
                            value={modData.duration}
                            onChange={(e) => setModData({ ...modData, duration: e.target.value })}
                        />
                    </label>

                    <label>
                        Max Members:
                        <input
                            type="number"
                            value={modData.maxMembers}
                            onChange={(e) => setModData({ ...modData, maxMembers: e.target.value })}
                        />
                    </label>

                    <button type="submit">Modify Slot</button>
                </form>
            </section><br/>

            {/* VIEW SLOTS */}
            <section className={styles.section}>
                <h2>View Slots</h2>
                <form onSubmit={handleView}>
                    <label>
                        Signup Sheet:
                        <select
                            value={viewSignupId}
                            onChange={(e) => setViewSignupId(e.target.value)}
                            required
                        >
                            <option value="">Select signup sheet</option>
                            {signupSheets.map((sheet) => (
                                <option key={sheet.signupId} value={sheet.signupId}>
                                    {sheet.signupId} - {sheet.assignmentName}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button type="submit">View</button>
                </form>

                <ul className={styles.list}>
                    {(slots[viewSignupId] || []).map((slot, i) => (
                        <li key={i}>
                            {slot.error
                                ? slot.error
                                : slot.empty
                                    ? "No slots found."
                                    : (
                                        <>
                                            Slot ID: {slot.slotId},
                                            Start: {slot.start},
                                            Duration: {slot.duration} min,
                                            Max: {slot.maxMembers},
                                            Members: {slot.members.length}
                                            <button onClick={() => handleDelete(slot.slotId)}>Delete</button>
                                        </>
                                    )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
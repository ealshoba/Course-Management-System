import React, { useEffect, useState } from "react";
import styles from "./Grade.module.css";
import { jwtDecode } from "jwt-decode";
import { Link, useNavigate } from "react-router-dom";

export default function GradeManagement() {
    const navigate = useNavigate();

    const [slot, setSlot] = useState(null);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    const [gradeInput, setGradeInput] = useState("");
    const [bonusInput, setBonusInput] = useState("");
    const [penaltyInput, setPenaltyInput] = useState("");
    const [commentInput, setCommentInput] = useState("");

    const [audit, setAudit] = useState(null);

    const [allSlots, setAllSlots] = useState([]);

    // Fetch all slots for dropdown
    useEffect(() => {
        const fetchAllSlots = async () => {
            try {
                const res = await fetch("/api/grades/all-slots", {
                    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
                });
                if (!res.ok) throw new Error("Failed to load slots");
                const data = await res.json();
                setAllSlots(data);
            } catch (err) {
                console.error(err);
            }
        };

        fetchAllSlots();
    }, []);



    // Auth check
    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        let decoded;
        try {
            decoded = jwtDecode(token);
        } catch {
            navigate("/login");
            return;
        }

        if (decoded.role !== "admin" && decoded.role !== "ta") {
            navigate("/home");
            return;
        }

        fetchCurrentSlot();
    }, []);


    // Load current slot
    const fetchCurrentSlot = async () => {
        try {
            const res = await fetch("/api/grades/current", {
                headers: { Authorization: "Bearer " + localStorage.getItem("token") }
            });

            if (!res.ok) throw new Error("Failed to load current slot");

            const data = await res.json();
            await loadSlot(data.slotId);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };


    // Load a specific slot
    const loadSlot = async (slotId) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/grades/slot/${slotId}`, {
                headers: { Authorization: "Bearer " + localStorage.getItem("token") }
            });

            const data = await res.json();
            setSlot(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    // Previous slot
    const goPrev = async () => {
        const res = await fetch(`/api/grades/previous/${slot.slotId}`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("token") }
        });

        if (!res.ok) {
            alert("No previous slot.");
            return;
        }

        const data = await res.json();
        loadSlot(data.slotId);
    };


    // Next slot
    const goNext = async () => {
        const res = await fetch(`/api/grades/next/${slot.slotId}`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("token") }
        });

        if (!res.ok) {
            alert("No next slot.");
            return;
        }

        const data = await res.json();
        loadSlot(data.slotId);
    };


    // Open modal
    const openModal = (m) => {
        setSelectedMember(m);

        setGradeInput(m.grade ?? "");
        setBonusInput(m.bonus ?? 0);
        setPenaltyInput(m.penalty ?? 0);
        setCommentInput("");

        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedMember(null);
        setAudit(null);
    };


    // Submit Grade
    const submitGrade = async () => {
        if (commentInput.trim() === "") {
            alert("A comment is required to create or modify a grade.");
            return;
        }

        const payload = {
            memberId: selectedMember.memberId,
            signupId: slot.signupId,
            grade: Number(gradeInput),
            bonus: Number(bonusInput),
            penalty: Number(penaltyInput),
            comment: commentInput.trim()
        };

        const res = await fetch("/api/grades/enter", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            alert("Failed to save grade");
            return;
        }

        await loadSlot(slot.slotId);
        closeModal();
    };


    // Audit History
    const viewAudit = async (m) => {
        const res = await fetch(`/api/grades/audit/${m.memberId}/${slot.signupId}`, {
            headers: { Authorization: "Bearer " + localStorage.getItem("token") }
        });

        if (!res.ok) {
            alert("No audit history found.");
            return;
        }

        const data = await res.json();
        setAudit(data[data.length - 1]);
    };

    if (loading) return <div className={styles.GradeContainer}>Loading...</div>;
    if (!slot) return <div className={styles.GradeContainer}>No slot found.</div>;

    return (
        <div className={styles.GradeContainer}>
            <Link className={styles.back} to="/home">&lt;&nbsp;Back</Link>

            <h1>Grading Mode</h1>

            <div className={styles.section}>
                <h2>Slot #{slot.slotId}</h2>

                <p><b>Start:</b> {slot.start}</p>
                <p><b>Duration:</b> {slot.duration} minutes</p>

                {/* Manual slot selection dropdown */}
                <label>Select Slot: </label>
                <select
                    value={slot.slotId}
                    onChange={(e) => loadSlot(Number(e.target.value))}
                    style={{ marginRight: "10px" }}
                >
                    {allSlots && allSlots.map(s => (
                        <option key={s.slotId} value={s.slotId}>
                            Slot #{s.slotId} | Start: {s.start} | Duration: {s.duration} min
                        </option>
                    ))}
                </select>

                <button onClick={goPrev}>Previous</button>
                <button onClick={goNext}>Next</button>
            </div>


            <div className={styles.section}>
                <h2>Members</h2>

                <ul className={styles.list}>
                    {slot.members.map((m) => (
                        <li className={styles.item} key={m.memberId}>
                            <span>{m.memberId}</span>

                            {m.grade !== null ? (
                                <span>
                                    Mark: {m.grade} | Bonus: {m.bonus} | Penalty: {m.penalty} |
                                    <b> Final: {m.final}</b>
                                </span>
                            ) : (
                                <span><i>No grade yet</i></span>
                            )}

                            <button onClick={() => openModal(m)}>Grade</button>
                            <button onClick={() => viewAudit(m)}>Audit</button>
                        </li>
                    ))}
                </ul>

                {audit && (
                    <div style={{
                        position: "fixed",
                        top: 0, left: 0,
                        width: "100%", height: "100%",
                        background: "rgba(0,0,0,0.5)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 1000
                    }}>
                        <div style={{
                            background: "#fff",
                            padding: 30,
                            borderRadius: 20,
                            width: 450,
                            maxWidth: "90%",
                            display: "flex",
                            flexDirection: "column",
                            gap: "15px"
                        }}>
                            <h2 style={{ textAlign: "center" }}>Audit History - Member {selectedMember?.memberId}</h2>

                            <div>
                                <b>User:</b> {audit.user}
                            </div>

                            <div>
                                <b>Time:</b> {new Date(audit.timestamp).toLocaleString()}
                            </div>

                            {audit.previous && (
                                <>
                                    <div>
                                        <b>Previous Grade:</b> {audit.previous.grade} | Bonus: {audit.previous.bonus || 0} | Penalty: {audit.previous.penalty || 0}
                                    </div>
                                    <div>
                                        <b>Previous Comment:</b> {audit.previous.comment}
                                    </div>
                                </>
                            )}

                            {audit.updated && (
                                <>
                                    <div>
                                        <b>Updated Grade:</b> {audit.updated.grade} | Bonus: {audit.updated.bonus || 0} | Penalty: {audit.updated.penalty || 0}
                                    </div>
                                    <div>
                                        <b>New Comment:</b> {audit.updated.comment}
                                    </div>
                                </>
                            )}

                            <div style={{ textAlign: "center", marginTop: 10 }}>
                                <button onClick={() => setAudit(null)} style={{ padding: "10px 20px", borderRadius: "10px" }}>Close</button>
                            </div>
                        </div>
                    </div>
                )}


            </div>

            {modalOpen && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0,
                    width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000
                }}>
                    <div style={{
                        background: "#fff",
                        padding: 30,
                        borderRadius: 20,
                        width: 450,
                        maxWidth: "90%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px"
                    }}>
                        <h2 style={{ textAlign: "center" }}>Grade Member {selectedMember.memberId}</h2>

                        <label>Mark</label>
                        <input
                            type="number"
                            value={gradeInput}
                            onChange={(e) => setGradeInput(e.target.value)}
                        />

                        <label>Bonus</label>
                        <input
                            type="number"
                            value={bonusInput}
                            onChange={(e) => setBonusInput(e.target.value)}
                        />

                        <label>Penalty</label>
                        <input
                            type="number"
                            value={penaltyInput}
                            onChange={(e) => setPenaltyInput(e.target.value)}
                        />

                        <label>Current Comment</label>
                        <textarea
                            value={selectedMember.comment || ""}
                            readOnly
                            style={{ background: "#f0f0f0", padding: "5px", borderRadius: "5px" }}
                        />

                        <label>New Comment (required)</label>
                        <textarea
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            placeholder="Enter comment here"
                        />

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                            <button onClick={submitGrade} style={{ padding: "10px 20px", borderRadius: "10px" }}>Save</button>
                            <button onClick={closeModal} style={{ padding: "10px 20px", borderRadius: "10px" }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import styles from "./SignupMem.module.css";

export default function SignupMem() {
    const API_URL = "/api/slots";
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const [availableSlots, setAvailableSlots] = useState([]);
    const [signedUpSlots, setSignedUpSlots] = useState([]);

    const [memberId, setMemberId] = useState("");

    // AUTH + Check for student role
    useEffect(() => {
        if (!token) return navigate("/login");

        try {
            const decoded = jwtDecode(token);

            if (decoded.role !== "student") {
                alert("Unauthorized: Student only.");
                return navigate("/home"); // Redirect if not a student
            }

            setMemberId(decoded.memberId);
            loadSignedUpSlots(decoded.memberId); // Load slots that user has signed up for
            loadAvailableSlots(); // Load all available slots to sign up
        } catch (err) {
            console.error(err);
            navigate("/login");
        }
    }, [token, navigate]);

    const authHeaders = () => ({
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    });

    // Load slots that the student has signed up for
    const loadSignedUpSlots = async (memberId) => {
        try {
            const res = await fetch(`${API_URL}/mySlots`, {
                headers: authHeaders(),
            });

            const data = await res.json();

            if (data.error) {
                setSignedUpSlots([{ error: data.error }]);
                return;
            }

            // Extract slots array from backend response
            const slotsArray = data.slots || [];

            if (slotsArray.length === 0) {
                setSignedUpSlots([{ empty: true }]);
                return;
            }

            setSignedUpSlots(slotsArray);
        } catch (err) {
            setSignedUpSlots([{ error: "Error loading signed up slots: " + err.message }]);
        }
    };

    // Load all available slots
    const loadAvailableSlots = async () => {
        try {
            const res = await fetch(`${API_URL}/availableSlots`, {
                headers: authHeaders(),
            });

            const data = await res.json();
            if (data.error) {
                setAvailableSlots([{ error: data.error }]);
                return;
            }

            const slotsArray = data.slots || [];
            if (slotsArray.length === 0) {
                setAvailableSlots([{ empty: true }]);
                return;
            }

            setAvailableSlots(slotsArray);
        } catch (err) {
            setAvailableSlots([{ error: "Error loading available slots: " + err.message }]);
        }
    };

    // Handle removing signup
    const handleRemoveSignup = async (signupId, slotId) => {
        const payload = {
            signupId: parseInt(signupId),
            slotId: parseInt(slotId),
            memberId: memberId,
        };

        try {
            const res = await fetch(`${API_URL}/leaveSlot`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.errors) {
                alert(data.errors.map((e) => e.msg).join("\n"));
                return;
            }

            if (data.error) {
                alert(data.error);
                return;
            }

            alert("Successfully removed from the slot.");
            loadSignedUpSlots(memberId);
            loadAvailableSlots();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    // Check if the slot is at least 2 hours ahead for removal
    const isValidRemoveSlot = (slot) => {
        const currentTime = new Date();
        const slotTime = new Date(slot.start);
        return slotTime - currentTime >= 2 * 60 * 60 * 1000; // 2 hours ahead
    };

    // Handle sign up for a slot
    const handleSignup = async (signupId, slotId) => {
        const payload = {
            signupId: signupId,
            slotId: slotId,
            memberId: memberId,
        };

        try {
            const res = await fetch(`${API_URL}/studentSignup`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.errors) {
                alert(data.errors.map((e) => e.msg).join("\n"));
                return;
            }

            if (data.error) {
                alert(data.error);
                return;
            }

            alert("Successfully signed up for the slot!");
            loadSignedUpSlots(memberId);
            loadAvailableSlots();
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    return (
        <div className={styles.SignupMemContainer}>
            <Link to="/home" className={styles.back}>&lt;&nbsp;Back</Link>

            <h1 className={styles.title}>Sign Up for Slots</h1>

            {/* View Signed up Slots */}
            <section className={styles.section}>
                <h2>Your Signed-up Slots</h2>
                <ul className={styles.list}>
                    {signedUpSlots.map((slot, i) => (
                        <li key={i}>
                            {slot.error ? (
                                slot.error
                            ) : slot.empty ? (
                                "You have not signed up for any slots."
                            ) : (
                                <>
                                    <strong>Slot ID:</strong> {slot.slotId}<br />
                                    <strong>Start:</strong> {slot.start}<br />
                                    <strong>Duration:</strong> {slot.duration} min<br />
                                    <strong>Max Members:</strong> {slot.maxMembers}<br />
                                    <strong>Current Members:</strong>{" "}
                                    {slot.members.length ? slot.members.join(", ") : "No members yet"}<br />
                                    {isValidRemoveSlot(slot) && (
                                        <button onClick={() => handleRemoveSignup(slot.signupId, slot.slotId)}>
                                            Remove Signup
                                        </button>
                                    )}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <br />

            {/* Available Slots */}
            <section className={styles.section}>
                <h2>Available Slots to Sign Up</h2>
                <ul className={styles.list}>
                    {availableSlots.map((slot, i) => (
                        <li key={i}>
                            {slot.error ? (
                                slot.error
                            ) : slot.empty ? (
                                "No available slots."
                            ) : (
                                <>
                                    <strong>Slot ID:</strong> {slot.slotId}<br />
                                    <strong>Start:</strong> {slot.start}<br />
                                    <strong>Duration:</strong> {slot.duration} min<br />
                                    <strong>Max Members:</strong> {slot.maxMembers}<br />
                                    <strong>Current Members:</strong>{" "}
                                    {slot.members.length ? slot.members.join(", ") : "No members yet"}<br />
                                    {slot.members.length < slot.maxMembers && !slot.members.includes(memberId) && (
                                        <button onClick={() => handleSignup(slot.signupId, slot.slotId)}>
                                            Sign Up
                                        </button>
                                    )}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
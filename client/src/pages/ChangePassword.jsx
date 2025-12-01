import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./ChangePassword.module.css";

export default function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const navigate = useNavigate();

    const handleAuthError = (res) => {
        if (res.status === 401) {
            alert("Session expired or invalid token. Please log in again.");
            localStorage.removeItem("token");
            navigate("/login");
            return true;
        }
        if (res.status === 403) {
            alert("You do not have permission to access this page.");
            navigate("/home");
            return true;
        }
        return false;
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (newPassword.length < 4) {
            alert("Password should be at least 4 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            alert("New passwords do not match.");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const email = localStorage.getItem("email");

            if (!email) {
                alert("Could not identify user. Please log in again.");
                navigate("/login");
                return;
            }

            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ email, currentPassword, newPassword }),
            });

            if (handleAuthError(res)) return;

            const data = await res.json();
            if (res.ok) {
                alert("Password changed successfully. Please log in again.");
                localStorage.removeItem("token");
                localStorage.removeItem("email");
                navigate("/login");
            } else {
                alert(data.error || "Failed to change password.");
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to the server.");
        }
    };

    return (
        <div className={styles["changePasswordPage"]}>

            <Link className={styles.back} to="/home">&lt;&nbsp;Back</Link>
            <h1 className={styles.title}>Change Password</h1>

            <div className={styles["change-password-container"]}>
                <form onSubmit={handleChangePassword}>
                    <label>
                        Current Password:
                        <input
                            type="password"
                            maxLength={200}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </label>

                    <label>
                        New Password:
                        <input
                            type="password"
                            maxLength={200}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Confirm New Password:
                        <input
                            type="password"
                            maxLength={200}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </label>

                    <button type="submit">Change Password</button>
                </form>
            </div>
        </div>
    );
}
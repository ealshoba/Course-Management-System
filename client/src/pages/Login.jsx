import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "./Login.module.css";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
            });

            const data = await res.json();
            console.log("Login response:", res.status, data);

            // Validation errors
            if (data.errors && Array.isArray(data.errors)) {
                setError(data.errors.join(" • "));
                return;
            }
            if (data.error) {
                setError(data.error);
                return;
            }

            // First-login (must change password)
            if (data.mustChangePassword) {
                localStorage.setItem("email", data.email);
                navigate("/change-password");
                return;
            }

            // Success with token
            if (data.token) {
                localStorage.setItem("token", data.token);
                if (data.role) localStorage.setItem("role", data.role);
                if (data.email) localStorage.setItem("email", data.email);
                navigate("/home");
                return;
            }

            if (data.message) {
                setError(data.message);
                return;
            }

            setError("Unexpected response from server. See console for details.");
        } catch (err) {
            console.error("Network/login error:", err);
            setError("Network error — please try again.");
        }
    };

    return (
        <div className={styles.loginPage}>
            <Link className={styles.back} to="/">&lt;&nbsp;Back</Link>
            <h1 className={styles.title}>Login</h1>

            <div className={styles["loginContainer"]}>
                <form onSubmit={handleSubmit}>
                    <label>
                        Email:
                        <input
                            type="email"
                            maxLength={100}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Password:
                        <input
                            type="password"
                            value={password}
                            maxLength={200}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>

                    <button type="submit">Login</button>
                </form><br />

                {error && <p className={styles.error}>{error}</p>}
            </div>
        </div>
    );
}
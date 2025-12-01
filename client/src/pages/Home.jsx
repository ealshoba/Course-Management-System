import React from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Home.module.css";
import { jwtDecode } from "jwt-decode";

export default function Home() {

    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const decoded = jwtDecode(token);
    const role = decoded.role;

    // Logout function
    const handleLogout = () => {
        localStorage.clear();
        alert("Logged out successfully.");
        navigate("/login");
    };

    return (
        <div className={styles["homePage"]}>
            <div className={styles.left}>
                {!token && <Link className={styles.login} to="/login">Login</Link>}
                {token && <Link className={styles.password} to="/change-password">Change Password</Link>}
            </div>

            <h1 className={styles.title}>Manager</h1>

            <div className={styles.right}>
                {token && (
                    <a className={styles.logout} onClick={handleLogout}>Logout</a>
                )}
            </div>

            <br />

            <div className={styles["home-container"]}>

                {/* Only visible when logged in */}
                {token && (
                    <>
                        {(role === "admin" || role === "ta") && (
                            <>
                                <p><Link to="/courses">Manage Courses</Link></p>
                                <p><Link to="/members">Manage Members</Link></p>
                                <p><Link to="/signup">Manage Signup Sheets</Link></p>
                                <p><Link to="/slots">Manage Slots</Link></p>
                                <p><Link to="/grades">Manage Grading</Link></p>
                            </>
                        )}

                        {role === "student" && (
                            <p><Link to="/signup-members">Sign Up for Slots</Link></p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import StartPage from "./pages/StartPage";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Home from "./pages/Home";
import Courses from "./pages/Courses";
import Members from "./pages/Members";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/home" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/members" element={<Members />} />

      </Routes>
    </Router>
  );
}

export default App;
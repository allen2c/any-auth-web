// client/base.jsx
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavigationBar from "./components/NavigationBar"; // Import NavigationBar

import HomePage from "./pages/HomePage";
import Login from "./pages/Login"; // Import Login page

export function createApp() {
  return (
    <Router>
      <div className="app-container">
        {" "}
        {/* Outer container */}
        <NavigationBar /> {/* Navigation bar at the top */}
        <main className="content">
          {" "}
          {/* Main content area */}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} /> {/* Login page route */}
            {/* ... Other pages ... */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

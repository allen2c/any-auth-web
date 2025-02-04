// client/base.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import NavigationBar from "./components/NavigationBar"; // Import NavigationBar
import HomePage from "./pages/HomePage";
import Login from "./pages/Login"; // Import Login page

// A layout component that conditionally renders the NavigationBar
function AppLayout() {
  const location = useLocation();
  // Check if the current pathname is '/login'
  const hideNav = location.pathname === "/login";

  return (
    <div className="app-container">
      {/* Render NavigationBar only if not on the login page */}
      {!hideNav && <NavigationBar />}
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          {/* ... Other pages ... */}
        </Routes>
      </main>
    </div>
  );
}

// Wrap the layout in the Router
export function createApp() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

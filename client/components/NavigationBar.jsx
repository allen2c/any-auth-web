// client/components/NavigationBar.jsx
import React from "react";
import { Link } from "react-router-dom";

function NavigationBar() {
  const isLoggedIn = false;

  return (
    <header className="w-full bg-white shadow">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
                  flex items-center justify-between h-16"
      >
        {/* Left side */}
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="AnyAuth Logo"
              style={{ height: "40px", width: "auto" }}
              className="object-contain"
            />
            <span className="text-2xl font-bold text-gray-900 ml-2">
              AnyAuth
            </span>
          </Link>
          <div className="relative group">
            <button
              type="button"
              className="text-gray-600 hover:text-gray-800 text-sm font-medium focus:outline-none"
            >
              Projects
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white shadow-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
              <Link
                to="/projects/alpha"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
              >
                Project Alpha
              </Link>
              <Link
                to="/projects/beta"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
              >
                Project Beta
              </Link>
              <Link
                to="/projects/gamma"
                className="block px-4 py-2 text-gray-600 hover:bg-gray-100"
              >
                Project Gamma
              </Link>
            </div>
          </div>
        </div>

        {/* 右側：根據登入狀態切換 */}
        {isLoggedIn ? (
          <div className="flex items-center space-x-4">
            <Link
              to="/console"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Console
            </Link>
            <div className="flex items-center space-x-2">
              <img
                src="/user-profile.png"
                alt="User Profile"
                className="h-8 w-8 rounded-full"
              />
              <span className="text-gray-700">User Name</span>
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}

export default NavigationBar;

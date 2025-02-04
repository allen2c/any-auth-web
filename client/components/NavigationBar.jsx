// client/components/NavigationBar.jsx
import React from "react";
import { Link } from "react-router-dom";

function NavigationBar() {
  const isLoggedIn = false;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Left side: Logo and Projects dropdown */}
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="AnyAuth Logo"
              style={{ height: "36px", width: "auto" }}
              className="h-10 w-auto object-contain"
            />
          </Link>
          <div className="relative group">
            <button
              type="button"
              className="flex items-center text-gray-600 hover:text-gray-800 text-sm font-medium focus:outline-none transition-colors duration-200"
            >
              Projects
              {/* Dropdown arrow icon */}
              <svg
                className="ml-1 h-4 w-4 fill-current"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
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

        {/* Right side: Conditional login/console */}
        <div>
          {isLoggedIn ? (
            <div className="flex items-center space-x-4">
              <Link
                to="/console"
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

export default NavigationBar;

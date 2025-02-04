// client/components/NavigationBar.jsx
import React from "react";
import { Link } from "react-router-dom";

function NavigationBar() {
  // Assume the user is not logged in
  const isLoggedIn = false;

  return (
    <header className="bg-white shadow">
      <nav className="flex flex-row flex-nowrap items-center justify-between max-w-7xl mx-auto px-4 lg:px-8 h-16">
        {/* Left side: Logo and primary navigation */}
        <div className="flex flex-row items-center space-x-10">
          <Link to="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="AnyAuth Logo"
              className="h-10 w-auto mr-2"
            />
            <span className="text-2xl font-bold text-gray-900">AnyAuth</span>
          </Link>
          <div className="flex flex-row space-x-8">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Home
            </Link>
            {/* Projects dropdown */}
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
            <Link
              to="/users"
              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Users
            </Link>
            <Link
              to="/settings"
              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Settings
            </Link>
          </div>
        </div>
        {/* Right side: User actions */}
        <div>
          {isLoggedIn ? (
            <div className="flex flex-row items-center space-x-4">
              <span className="text-gray-700">Welcome, User</span>
              <Link
                to="/console"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                Console
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
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

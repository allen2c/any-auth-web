// client/pages/Login.jsx
import React, { useState } from "react";

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-page">
      <div className="container">
        <h1>Login</h1>
        <form action="/c/login" method="post">
          {" "}
          {/* Form submission to backend /c/login route */}
          <input
            type="text"
            id="username_or_email"
            name="username_or_email"
            placeholder="Username or Email"
            required
          />
          <div className="password-input-container">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder="Password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit">Login</button>
        </form>
        <hr />
        <div>
          <h3>Or use other login methods</h3>
          <a href="/auth/google/login" className="google-login-btn">
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google Logo"
              className="google-icon"
            />
            Login with Google
          </a>
        </div>
        <div className="mt-4 text-sm">
          {/* Optional registration link */}
          {/* <Link to="/register" className="text-indigo-600 hover:text-indigo-800">
            No account yet? Register
          </Link> */}
        </div>
      </div>
    </div>
  );
}

export default Login;

// client/pages/Login.jsx
import React, { useState } from "react";

function Login() {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleGoogleLogin = (e) => {
    e.preventDefault();
    const width = 500,
      height = 600;
    /* eslint-disable-next-line no-undef */
    const left = (window.screen.width - width) / 2; // noqa
    /* eslint-disable-next-line no-undef */
    const top = (window.screen.height - height) / 2;
    /* eslint-disable-next-line no-undef */
    window.open(
      "/auth/google/login", // This route is provided by fastify-oauth2
      "GoogleLogin",
      `width=${width},height=${height},top=${top},left=${left}`
    );
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
          <button onClick={handleGoogleLogin} className="google-login-btn">
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google Logo"
              className="google-icon"
            />
            Login with Google
          </button>
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

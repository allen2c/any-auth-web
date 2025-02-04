// client/pages/Login.jsx
import React from "react";

function Login() {
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
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Password"
            required
          />
          <button type="submit">Login</button>
        </form>
        <hr />
        <div>
          <h3>Or use Google Login</h3>
          <a href="/auth/google/login" className="google-login-btn">
            Use Google Login
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

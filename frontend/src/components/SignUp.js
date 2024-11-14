// frontend/src/components/SignUp.js

import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';

const SignUp = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      // Log form data before sending
      console.log("Submitting sign-up:", { username, password });

      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/signup`, { username, password });

      if (response.status === 200) {
        // Set the token in cookies with path '/'
        Cookies.set('token', response.data.authToken, { expires: 1, path: '/' });
        console.log("Token set in cookies after signup (SignUp.js):", response.data.authToken);
        setSuccess("Account created successfully! Redirecting to login page...");
        setTimeout(() => navigate("/"), 2000);  // Redirect after 2 seconds
      }
    } catch (error) {
      console.error("Sign-up failed", error);

      // Improved error handling
      if (error.response && error.response.status === 400) {
        setError(error.response.data.error || "User already exists or invalid details.");
      } else {
        setError("An error occurred. Please try again later.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center  bg-gradient-to-r from-green-500 to-blue-500">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg transform transition-all duration-500 hover:shadow-xl">
        <img src="https://d2kcusespnhzzh.cloudfront.net/vidcompressor_logo.png" alt="logo" className="w-[120px] object-contain m-auto mb-4" />

        {/* Web App Name */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800">VideoLite</h1>
          <p className="text-gray-600 mt-2">Create your account to start compressing videos!</p>
        </div>
        {/* Error and Success Messages */}
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
        {success && <p className="text-green-500 mb-4 text-center">{success}</p>}
        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-300"
              placeholder="Username (in email format)"
            />
          </div>
          <div className="relative">
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-300"
              placeholder="Password"
            />
          </div>
          <div className="relative">
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-300"
              placeholder="Confirm Password"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold rounded-md hover:from-blue-500 hover:to-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300 transform hover:scale-105"
          >
            Sign Up
          </button>
        </form>
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">Already have an account? <a href="/" className="text-blue-500 hover:text-blue-600">Log in</a></p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;

// frontend/src/components/Login.js


import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false); // State for toggling password visibility
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/login`, {
        username,
        password
      },
        {
          withCredentials: true,
          headers: {
            'Accept': 'application/json'
          }
        });

      if (response.status === 200) {
        // Set the token in cookies with path '/'
        console.log(process.env.REACT_APP_API_BASE_URL)
        console.log(response)
        Cookies.set('token', response.data.authToken, { expires: 1, path: '/' });
        console.log("Token set in cookies after login (Login.js):", response.data.authToken);
        navigate("/home");
      }
    } catch (error) {
      console.error("Login failed", error);
      if (error.response && error.response.status === 400) {
        setError("Invalid username or password. Please try again.");
      } else {
        setError("An error occurred. Please try again later.");
      }
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-green-500 to-blue-500">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg transform transition-all duration-500 hover:shadow-xl">
        <img src="https://d2kcusespnhzzh.cloudfront.net/vidcompressor_logo.png" alt="logo" className="w-[120px] object-contain m-auto mb-4" />
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-4">VideoLite</h1>
          <p className="text-gray-600 mt-2">Please Login</p>
        </div>
        {error && <p className="text-red-500 mb-4 text-center">{error}</p>}
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
              type={showPassword ? "text" : "password"}  // Change input type based on showPassword state
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-300"
              placeholder="Password"
            />
            {/* Toggle password visibility icon */}
            <div
              className="absolute inset-y-0 right-3 flex items-center cursor-pointer"
              onClick={togglePasswordVisibility}
            >
              <img
                src={showPassword ? "/assets/eye-close.svg" : "/assets/eye-open.svg"}
                alt={showPassword ? "Hide password" : "Show password"}
                className="h-6 w-6 text-gray-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold rounded-md hover:from-blue-500 hover:to-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300 transform hover:scale-105"
          >
            Login
          </button>
        </form>
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">Don't have an account? <a href="/signup" className="text-blue-500 hover:text-blue-600">Sign up</a></p>
        </div>
      </div>
    </div>
  );
};

export default Login;

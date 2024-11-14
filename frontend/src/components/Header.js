import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';  // Ensure correct import
import { HomeIcon, ClockIcon, LogoutIcon, SunIcon, MoonIcon, BadgeCheckIcon } from '@heroicons/react/outline';

const Header = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false); // State for theme toggle
  const [isPremium, setIsPremium] = useState(false); // State to track if user is premium

  useEffect(() => {
    // On component mount, check for saved theme preference
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      setDarkMode(savedTheme === 'true');
      document.body.classList.toggle('dark', savedTheme === 'true');
      console.log('Theme loaded from localStorage:', savedTheme === 'true' ? 'Dark Mode' : 'Light Mode');
    }

    // Check if the user is premium from JWT token (same logic as Home.js)
    const token = Cookies.get('token');
    if (token) {
      const decodedToken = jwtDecode(token);

      // Assuming the groups are stored under 'cognito:groups'
      const userGroups = decodedToken['cognito:groups'] || [];

      if (userGroups.includes('Premium')) {
        setIsPremium(true);  // Set user as premium
      }
    }
  }, []);

  const handleLogout = () => {
    Cookies.remove('token', { path: '/' });
    console.log("Token removed from cookies (Header.js).");
    navigate('/');
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark', !darkMode);
    localStorage.setItem('darkMode', !darkMode); // Save theme preference
    console.log('Theme toggled to:', !darkMode ? 'Dark Mode' : 'Light Mode');
  };

  return (
    <header className={`bg-gray-900 text-gray-900 dark:text-white shadow-md transition-colors duration-300`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <img src="https://d2kcusespnhzzh.cloudfront.net/vidcompressor_logo.png" alt="logo" className="w-[50px] object-contain" />
          <h1 className='text-2xl font-bold pe-10 text-white'>VideoLite</h1>
          <a
            href="/home"
            className="flex items-center bg-gradient-to-r from-blue-400 to-blue-500 text-white hover:from-blue-500 hover:to-blue-600 px-4 py-2 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 hover:shadow-lg"
          >
            <HomeIcon className="h-5 w-5 mr-2" />
            Home
          </a>
          <a
            href="/history"
            className="flex items-center bg-gradient-to-r from-green-400 to-green-500 text-white hover:from-green-500 hover:to-green-600 px-4 py-2 rounded-full shadow-md transform transition duration-300 ease-in-out hover:scale-105 hover:shadow-lg"
          >
            <ClockIcon className="h-5 w-5 mr-2" />
            History
          </a>
        </div>

        <div className="flex items-center space-x-4">
          {/* Show premium badge if the user is premium */}
          {isPremium && (
            <div className="flex items-center bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-3 py-2 rounded-full shadow-md transform text-sm font-medium transition duration-300 ease-in-out">
              <BadgeCheckIcon className="h-5 w-5 mr-2" />
              Premium User
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white px-3 py-2 rounded-full text-sm font-medium transition duration-300 transform hover:scale-105"
          >
            {darkMode ? <SunIcon className="h-5 w-5 mr-2" /> : <MoonIcon className="h-5 w-5 mr-2" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-500 text-white px-3 py-2 rounded-full text-sm font-medium transition duration-300 transform hover:scale-105"
          >
            <LogoutIcon className="h-5 w-5 mr-2" />
            Logout
          </button>
        </div>
      </nav>
    </header>
  );
};

export default Header;

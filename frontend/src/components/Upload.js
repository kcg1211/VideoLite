// frontend/src/components/Upload.js

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import Header from './Header';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const API_HISTORY_URL = process.env.REACT_APP_API_HISTORY_URL;

const Upload = () => {
  const [latestVideo, setLatestVideo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch video history from the backend to get the most recent video
    const fetchLatestVideo = async () => {
      try {
        const authToken = Cookies.get('token');

        const response = await axios.get(`${API_HISTORY_URL}/api/history`, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (response.status === 200) {
          const history = response.data.history;

          // Sort history to get the most recent video (if not already sorted by the backend)
          const sortedHistory = history.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

          // Get the latest video
          if (sortedHistory.length > 0) {
            setLatestVideo(sortedHistory[0]);  // Set the most recent video
          } else {
            setError('No videos found in your history.');
          }
        } else {
          setError('Error fetching video history.');
        }
      } catch (error) {
        console.error('Error fetching latest video:', error);
        setError('Error fetching latest video.');
      }
    };
    fetchLatestVideo();
  }, []);

  const handleDownload = async (filename) => {
    try {
      const authToken = Cookies.get('token');
      const response = await axios.get(`${API_BASE_URL}/api/download/${filename}`, {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const downloadUrl = response.data.downloadUrl;

      const fileResponse = await axios.get(downloadUrl, {
        responseType: 'blob', // Important: set response type to 'blob' to handle binary data
      });

      // Create a URL from the Blob and trigger the download
      const blobUrl = window.URL.createObjectURL(new Blob([fileResponse.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename); // Set the download attribute to suggest a filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Release the object URL to free up memory
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setError('Error downloading file. Please try again later.');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-r from-green-400 to-blue-500 dark:from-green-800 dark:to-blue-900 text-black dark:text-white transition-colors duration-300">
        <Header />
        <div className="flex items-center justify-center flex-grow py-10">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl w-full">
            <p className="text-center text-red-500 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!latestVideo) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-r from-green-400 to-blue-500 dark:from-green-800 dark:to-blue-900 text-black dark:text-white transition-colors duration-300">
        <Header />
        <div className="flex items-center justify-center flex-grow py-10">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl w-full">
            <p className="text-center">Loading compressed video...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-r from-green-400 to-blue-500 dark:from-green-800 dark:to-blue-900 text-black dark:text-white transition-colors duration-300">
      <Header />
      <div className="flex items-center justify-center flex-grow py-10">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-4xl w-full">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-10">Compressed Video</h1>
          </div>

          <div className="mt-5">
            <div className="flex justify-center">
              <video
                controls
                src={latestVideo.s3Url}  // Use the pre-signed S3 URL
                style={{ width: '100%', maxWidth: '900px' }}
                className="rounded-lg shadow-md"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="info_card bg-gradient-to-r from-green-200 to-blue-200 dark:from-gray-600 dark:to-gray-700 px-6 py-4 rounded-lg shadow-md mt-6">
              <p className="my-3 text-lg font-semibold text-center text-gray-600 dark:text-gray-300">
                Original File size: {latestVideo.originalSize} MB
              </p>
              <p className="my-3 text-lg font-semibold text-center text-gray-600 dark:text-gray-300">
                New Compressed File size: {latestVideo.compressedSize} MB
              </p>
              <p className="mt-3 mb-3 text-2xl font-bold text-center text-green-100 dark:text-green-200 bg-green-500 dark:bg-green-600 py-2 px-4 rounded-full shadow-sm">
                🎉 You saved: {(latestVideo.originalSize - latestVideo.compressedSize).toFixed(2)} MB! 🎉
              </p>
            </div>

            <div className="flex justify-center space-x-4 mt-4">
              <a
                href="/home"
                className="bg-gradient-to-r from-green-400 to-green-500 dark:from-green-500 dark:to-green-600 hover:from-green-500 hover:to-green-400 text-white py-2 px-4 rounded-full transition duration-300 transform hover:scale-105 cursor-pointer"
              >
                Back
              </a>
              <a
                href="/history"
                className="bg-gradient-to-r from-green-400 to-green-500 dark:from-green-500 dark:to-green-600 hover:from-green-500 hover:to-green-400 text-white py-2 px-4 rounded-full transition duration-300 transform hover:scale-105 cursor-pointer"
              >
                All Videos
              </a>
              <button onClick={() => handleDownload(latestVideo.compressedFilename)} className="flex items-center bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white px-3 py-2 rounded-full text-sm font-medium transition duration-300 transform hover:scale-105">
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;

// frontend/src/components/History.js

import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import Header from './Header';

// Use environment variable for API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const API_HISTORY_URL = process.env.REACT_APP_API_HISTORY_URL;

const History = () => {
  const [videoHistory, setVideoHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // Loading state for S3 videos
  const [currentPage, setCurrentPage] = useState(1);
  const [videosPerPage] = useState(3); // Number of videos per page
  const [sortOption, setSortOption] = useState('recent'); // Sorting state
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal state
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(''); // Selected video URL for modal
  const videoRefs = useRef({}); // Reference to store video elements
  const modalRef = useRef(null); // Reference to the modal container for click-outside detection

  // Fetch video history
  useEffect(() => {
    const fetchVideoHistory = async () => {
      setLoading(true);
      try {
        const authToken = Cookies.get('token');
        const response = await axios.get(`${API_HISTORY_URL}/api/history`, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (response.status === 200) {
          setVideoHistory(response.data.history);
        } else {
          setError('Unexpected response from server. Please try again later.');
        }
      } catch (error) {
        setError('Error fetching video history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoHistory();
  }, []);

  // Sort the video history based on selected option
  const sortVideos = (videos) => {
    if (sortOption === 'recent') {
      return videos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)); // Most recent first
    } else if (sortOption === 'alphabetical') {
      return videos.sort((a, b) => a.compressedFilename.localeCompare(b.compressedFilename)); // Alphabetical
    } else if (sortOption === 'oldest') {
      return videos.sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate)); // Oldest
    }
    return videos;
  };

  // Function to handle sorting option change
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  // Function to load videos from S3 and set them in video elements
  const loadVideosFromS3 = async (videos) => {
    try {
      const authToken = Cookies.get('token');

      for (let video of videos) {
        const response = await axios.get(`${API_BASE_URL}/api/download/${video.compressedFilename}`, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        const downloadUrl = response.data.downloadUrl;

        // Set the video source
        if (videoRefs.current[video.compressedFilename]) {
          videoRefs.current[video.compressedFilename].src = downloadUrl;
        }
      }
    } catch (error) {
      setError('Error loading video content. Please try again later.');
    }
  };

  // Load videos from S3 when loading is complete, video history, pagination, or sortOption changes
  useEffect(() => {
    if (!loading && videoHistory.length > 0) {
      const indexOfLastVideo = currentPage * videosPerPage;
      const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
      const currentVideos = videoHistory.slice(indexOfFirstVideo, indexOfLastVideo);
      loadVideosFromS3(currentVideos);
    }
  }, [loading, videoHistory, currentPage, videosPerPage, sortOption]);

  // Function to handle the download
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

  // Function to handle delete
  const handleDelete = async (filename) => {
    try {
      const authToken = Cookies.get('token');
      await axios.delete(`${API_BASE_URL}/api/delete/${filename}`, {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      // Remove the deleted video from the state to update the UI
      const updatedVideoHistory = videoHistory.filter((video) => video.compressedFilename !== filename);
      setVideoHistory(updatedVideoHistory);

      // If there are no more videos on the current page, and we are not on the first page, go to the previous page
      const totalVideos = updatedVideoHistory.length;
      const totalPages = Math.ceil(totalVideos / videosPerPage);

      if (currentPage > totalPages) {
        setCurrentPage(totalPages || 1); // Go back to the previous page or first page if no more pages
      }
    } catch (error) {
      setError('Error deleting file. Please try again later.');
    }
  };

  // Function to open the modal and play the video using a presigned S3 URL
  const playVideoWithSignedUrl = async (filename) => {
    try {
      const authToken = Cookies.get('token');
      const response = await axios.get(`${API_BASE_URL}/api/download/${filename}`, {
        withCredentials: true,
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const downloadUrl = response.data.downloadUrl;

      // Open modal and set the selected video URL for the modal
      setSelectedVideoUrl(downloadUrl);
      setIsModalOpen(true);
    } catch (error) {
      setError('Error fetching video. Please try again later.');
    }
  };

  // Close modal handler
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVideoUrl(''); // Clear the video URL when modal is closed
  };

  // Close modal if clicked outside
  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      handleCloseModal();
    }
  };

  // Handle Escape key press to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Sort the video history before displaying it
  const sortedVideos = sortVideos(videoHistory);

  // Get current videos
  const indexOfLastVideo = currentPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = sortedVideos.slice(indexOfFirstVideo, indexOfLastVideo);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white transition-colors duration-300">
      <Header />
      <div className="flex-grow flex flex-col justify-between items-center text-gray-900 dark:text-white py-6 transition-colors duration-300 bg-gradient-to-r from-green-400 to-blue-500 dark:from-green-700 dark:to-blue-800">
        <div className="w-full max-w-[1000px] p-4">
          <h1 className="text-3xl font-bold mb-6 text-center text-white dark:text-white">Video Compression History</h1>

          {loading ? (
            <div className="flex justify-center items-center">
              <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full text-blue-500" role="status"></div>
              <span className="ml-2 text-white">Loading videos...</span>
            </div>
          ) : sortedVideos.length > 0 ? (
            <div>
              {/* Sorting Dropdown */}
              <div className="mb-4 flex justify-end">
                <label className="text-white dark:text-gray-300 mr-2 mt-2">Sort By:</label>
                <select value={sortOption} onChange={handleSortChange} className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-400 transition duration-100">
                  <option value="recent">Most Recent</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
              {/* Videos List Cards */}
              <div className="grid grid-cols-1 gap-8">
                {currentVideos.map((video, index) => (
                  <div key={index} className="bg-white dark:bg-gray-700 rounded-lg shadow-md flex items-center p-6 space-x-6 transition-colors duration-300">
                    {/* Thumbnail Preview with Play Icon */}
                    <div
                      className="relative w-48 h-28 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg group"
                      onClick={() => playVideoWithSignedUrl(video.compressedFilename)}
                    >
                      <video ref={(el) => (videoRefs.current[video.compressedFilename] = el)} controls={false} preload="metadata" style={{ width: '100%', height: '100%' }} className="rounded-md shadow-md object-cover">
                        Your browser does not support the video tag.
                      </video>
                      {/* Play Icon that fades in on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center opacity-100 duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-5.197-2.519A1 1 0 008 9.525v4.95a1 1 0 001.555.832l5.197-2.518a1 1 0 000-1.736z" />
                        </svg>
                      </div>
                    </div>

                    {/* Video Info */}
                    <div className="flex flex-col truncate overflow-hidden text-ellipsis flex-grow">
                      <p className="text-gray-800 dark:text-gray-300 font-semibold truncate">Original File: {video.originalFilename}</p>
                      <p className="text-gray-800 dark:text-gray-300 truncate">Compressed File: {video.compressedFilename}</p>
                      <p className="text-gray-600 dark:text-gray-400 truncate">Original Size: {video.originalSize} MB</p>
                      <p className="text-gray-600 dark:text-gray-400 truncate">Compressed Size: {video.compressedSize} MB</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <button onClick={() => handleDownload(video.compressedFilename)} className="flex items-center bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white px-3 py-2 rounded-full text-sm font-medium transition duration-300 transform hover:scale-105">
                        Download
                      </button>
                      <button onClick={() => handleDelete(video.compressedFilename)} className="flex items-center bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-500 text-white px-3 py-2 rounded-full text-sm font-medium transition duration-300 transform hover:scale-105">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-white dark:text-gray-300">No videos found in your history.</p>
          )}

          {/* Display error message */}
          {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
        </div>

        {/* Pagination */}
        {sortedVideos.length > videosPerPage && (
          <div className="flex justify-center mt-6 w-full p-4 rounded-b-lg">
            {Array.from({ length: Math.ceil(sortedVideos.length / videosPerPage) }, (_, i) => (
              <button
                key={i}
                onClick={() => paginate(i + 1)}
                className={`mx-1 px-4 py-2 rounded-full ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} transition duration-200`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Fullscreen Video */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50" onClick={handleOutsideClick}>
          <div ref={modalRef} className="relative w-4/5 h-4/5 bg-black rounded-lg shadow-lg">
            <button onClick={handleCloseModal} className="absolute top-3 right-3 text-white bg-gray-500 hover:bg-gray-600 rounded-full p-2 px-4 z-10 transition duration-200">
              X
            </button>
            <video src={selectedVideoUrl} controls className="w-full h-full object-contain" autoPlay />
          </div>
        </div>
      )}
    </div>
  );
};

export default History;

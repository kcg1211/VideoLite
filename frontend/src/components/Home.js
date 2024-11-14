//frontend/src/components/Home.js

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import Header from './Header';

const API_COMPRESSION_URL = process.env.REACT_APP_API_COMPRESSION_URL;

const Home = () => {
  const [file, setFile] = useState(null);
  const [fileSize, setFileSize] = useState('');
  const [videoSrc, setVideoSrc] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [authToken, setAuthToken] = useState('');
  const [format, setFormat] = useState('mp4'); // Default format
  const [resolution, setResolution] = useState('720p'); // Default resolution
  const [bitrate, setBitrate] = useState('medium'); // Default bitrate
  const [frameRate, setFrameRate] = useState('30'); // Default frame rate
  const [isPremium, setIsPremium] = useState(false);  // Track if the user is premium
  const [isUploading, setIsUploading] = useState(false); // Track upload status
  const navigate = useNavigate();
  const videoPlayerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      setError('User not authenticated. Please log in.');
      return;
    }

    setAuthToken(token);

    // Decode the token and check if the user is part of the "Premium" group
    const decodedToken = jwtDecode(token);

    // Assuming the groups are stored under 'cognito:groups'
    const userGroups = decodedToken['cognito:groups'] || [];

    if (userGroups.includes('Premium')) {
      setIsPremium(true);  // Set user as premium
    }
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    if (selectedFile) {
      const videoUrl = URL.createObjectURL(selectedFile);
      setVideoSrc(videoUrl);
      setFileSize((selectedFile.size / (1024 * 1024)).toFixed(2) + ' MB');
      setError(''); // Clear any previous error
    } else {
      setFileSize('');
    }
  };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   if (!file) {
  //     setError('Please select a video file to compress.');
  //     return;
  //   }

  //   if (!authToken) {
  //     setError('User not authenticated. Please log in.');
  //     return;
  //   }

  //   setIsUploading(true); // Start the uploading state

  //   const formData = new FormData();
  //   formData.append('file', file);

  //   try {
  //     const uploadResponse = await axios.post(`${API_COMPRESSION_URL}/api/upload`, formData, {
  //       withCredentials: true,
  //       headers: {
  //         'Content-Type': 'multipart/form-data',
  //         'Authorization': `Bearer ${authToken}`,
  //       },
  //     });

  //     if (uploadResponse.status === 200) {
  //       setIsUploading(false); // Stop showing "Uploading..."

  //       // Start polling for compression progress
  //       const pollProgress = setInterval(async () => {
  //         try {
  //           const progressResponse = await axios.get(`${API_COMPRESSION_URL}/api/progress`);
  //           const data = progressResponse.data;
  //           setProgress(data.progress);

  //           // Stop polling if progress reaches 100%
  //           if (data.progress === 100) {
  //             clearInterval(pollProgress);
  //           }
  //         } catch (error) {
  //           console.error('Error fetching compression progress:', error);
  //           clearInterval(pollProgress);
  //         }
  //       }, 1000); // Poll every second

  //       const processResponse = await axios.post(`${API_COMPRESSION_URL}/api/process`, {
  //         format, resolution, bitrate, frameRate
  //       }, {
  //         withCredentials: true,
  //         headers: {
  //           'Authorization': `Bearer ${authToken}`,
  //         }
  //       });

  //       if (processResponse.status === 200) {
  //         setProgress(100);
  //         const { compressedFilename, s3Url, compressedSize, originalSize } = processResponse.data;
  //         navigate('/uploads', {
  //           state: {
  //             compressedFilename,
  //             s3Url,
  //             compressedSize,
  //             originalSize,
  //           },
  //         });
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error uploading or processing video:', error);
  //     setError('Error uploading or processing video. Please try again later.');
  //     setIsUploading(false); // Stop uploading state if there's an error
  //   }
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a video file to compress.');
      return;
    }

    if (!authToken) {
      setError('User not authenticated. Please log in.');
      return;
    }

    setIsUploading(true); // Start the uploading state

    // Upload the file
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadResponse = await axios.post(`${API_COMPRESSION_URL}/api/upload`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (uploadResponse.status === 200) {
        setIsUploading(false); // Stop showing "Uploading..."

        // Set progress to 100% immediately since polling is removed
        setProgress(100);

        const processResponse = await axios.post(`${API_COMPRESSION_URL}/api/process`, {
          format, resolution, bitrate, frameRate
        }, {
          withCredentials: true,
          headers: {
            'Authorization': `Bearer ${authToken}`,
          }
        });

        if (processResponse.status === 200) {
          // Navigate to /uploads and pass the compressed video data
          const { compressedFilename, s3Url, compressedSize } = processResponse.data;
          navigate('/uploads', {
            state: {
              compressedFilename,
              s3Url,
              compressedSize,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error uploading or processing video:', error);
      setError('Error uploading or processing video. Please try again later.');
    }
  };
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-r from-green-400 to-blue-500 dark:from-green-700 dark:to-blue-800 text-black dark:text-white transition-colors duration-300">
      <Header isPremium={isPremium} /> {/* Pass isPremium to Header component */}
      <div className="flex items-center justify-center flex-grow py-10">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-6xl w-full flex flex-col items-center transition-colors duration-300 transform hover:shadow-2xl mx-5">
          <div className="text-center mb-8 w-full">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Welcome to VideoLite</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Easily compress and convert your videos</p>
          </div>

          <div className="flex w-full">
            <div className="w-2/3 flex h-full flex-col pr-6">
              <div
                className="h-full flex-grow flex items-center justify-center border-dashed border-2 border-gray-300 rounded-md dark:border-gray-600 p-4 bg-gray-100 dark:bg-gray-700 cursor-pointer"
                onClick={() => fileInputRef.current.click()}
                style={{ aspectRatio: '16/9' }}
                onDragOver={(e) => e.preventDefault()} // Prevent default drag over behavior
                onDrop={(e) => {
                  e.preventDefault(); // Prevent default drop behavior
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith("video/")) {
                    handleFileChange({ target: { files: [file] } });
                  }
                }}
              >
                {videoSrc ? (
                  <video
                    id="videoPlayer"
                    ref={videoPlayerRef}
                    src={videoSrc}
                    controls
                    className="w-full h-full object-cover rounded-md shadow-md"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-500 dark:text-gray-300">
                      Drag and drop a video file here, or click to select a file
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </div>

              {fileSize && (
                <p className="text-gray-700 dark:text-gray-300 text-xl text-center font-bold mt-5">
                  Current File Size: {fileSize}
                </p>
              )}
            </div>


            <div className="w-1/3">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block font-medium mb-1 text-black dark:text-gray-300">Output Format:</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-400 transition duration-300"
                  >
                    <option value="mp4">MP4</option>

                    {/* Premium options: still show them but disable if not premium */}
                    <option value="avi" className="disabled:text-red-600" disabled={!isPremium}>AVI {!isPremium && "(Premium only)"}</option>
                    <option value="mov" className="disabled:text-red-600" disabled={!isPremium}>MOV {!isPremium && "(Premium only)"}</option>
                    <option value="mkv" className="disabled:text-red-600" disabled={!isPremium}>MKV {!isPremium && "(Premium only)"}</option>
                  </select>
                  {/* {!isPremium && <small className="text-red-500">Premium users can access more formats</small>} */}
                </div>

                <div>
                  <label className="block font-medium mb-1 text-black dark:text-gray-300">Resolution:</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-400 transition duration-300"
                  >
                    <option value="720p">720p</option>

                    {/* Premium resolution option */}
                    <option value="1080p" className="disabled:text-red-600" disabled={!isPremium}>1080p {!isPremium && "(Premium only)"}</option>
                  </select>
                </div>


                <div>
                  <label className="block font-medium mb-1 text-black dark:text-gray-300">Bitrate:</label>
                  <select value={bitrate} onChange={(e) => setBitrate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-400 transition duration-300">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-black dark:text-gray-300">Frame Rate:</label>
                  <select
                    value={frameRate}
                    onChange={(e) => setFrameRate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-400 transition duration-300"
                  >
                    <option value="30">30 FPS</option>

                    {/* Premium frame rate option */}
                    <option value="60" className="disabled:text-red-600" disabled={!isPremium}>60 FPS {!isPremium && "(Premium only)"}</option>
                  </select>
                </div>


                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-md hover:from-green-400 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300 transform hover:scale-105"
                >
                  Compress
                </button>
                {error && <p className="text-red-500 dark:text-red-400 mt-4 text-center">{error}</p>}
              </form>
            </div>
          </div>

          {/* Progressbar */}

          {isUploading ? (
            <div className="flex items-center mt-6 w-full bg-gradient-to-r from-green-200 to-blue-200 dark:from-gray-600 dark:to-gray-700 px-6 py-4 rounded-lg shadow-md justify-center">
              <div className="loader mr-7"></div>
              <p className="text-xl font-bold text-gray-500 dark:text-gray-300">Uploading...</p>
              <div className="loader ml-7"></div>
            </div>
          ) : (
            progress > 0 && (
              <div className="flex flex-col items-center mt-6 w-full bg-gradient-to-r from-green-200 to-blue-200 dark:from-gray-600 dark:to-gray-700 px-6 py-3 rounded-lg shadow-md justify-center">
                <div className="flex items-center mb-0 py-2 px-4 rounded-full">
                  <div className="loader loader-gradient mr-4 rotate-180"></div>
                  <p className="text-xl font-bold text-gray-500 dark:text-gray-300">Compressing...</p>
                  <div className="loader loader-gradient ml-4 rotate-180"></div>
                </div>

                {/* Progress Bar Container */}
                {/* <div className="w-full bg-gray-200 dark:bg-gray-700 mt-2 rounded-full h-8 shadow-md overflow-hidden mb-2"> */}

                {/* Progress Indicator */}
                {/* <div
                    className="bg-gradient-to-r from-green-500 to-blue-500 dark:from-green-400 dark:to-blue-600 h-full flex items-center justify-center transition-all duration-300 ease-linear rounded-full"
                    style={{ width: `${progress}%` }}
                  >
                    <span className="font-extrabold text-white dark:text-gray-200">{progress}%</span>
                  </div>
                </div> */}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;

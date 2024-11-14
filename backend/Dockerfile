# backend/Dockerfile

# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed dependencies
RUN npm install

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Set the environment variable for the client origin
ENV CLIENT_ORIGIN=http://videolite.cab432.com:3000  

# Copy the rest of the backend application code
COPY . .

# Expose the backend port
EXPOSE 5000

# Command to run your backend application
CMD ["node", "index.js"]

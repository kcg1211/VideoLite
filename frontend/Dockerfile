# frontend/Dockerfile

# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Set the environment variable for the API base URL
ENV REACT_APP_API_BASE_URL=https://api.videolite.cab432.com
ENV REACT_APP_API_HISTORY_URL=https://api.videolite.cab432.com
ENV REACT_APP_API_COMPRESSION_URL=https://api.videolite.cab432.com 

# Copy the rest of the frontend application code
COPY . .

# Build the React frontend
RUN npm run build

# Install a lightweight web server (serve) to serve the static build files
RUN npm install -g serve

# Expose the frontend port
EXPOSE 3000

# Command to serve the built React app
CMD ["serve", "-s", "build", "-l", "3000"]
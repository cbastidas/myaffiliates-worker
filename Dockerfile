# Use the official Microsoft Playwright image
FROM mcr.microsoft.com/playwright:v1.46.0-jammy

# Set work directory
WORKDIR /usr/src/app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files (including your .json session files)
COPY . .

# Expose port 3000
EXPOSE 3000

# Run the server
CMD [ "node", "server.js" ]
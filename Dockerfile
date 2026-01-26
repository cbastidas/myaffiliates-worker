# Update to the version required by your logs
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy the rest of your app
COPY . .

# Ensure the port is dynamic for Railway
ENV PORT=8080
EXPOSE 8080

CMD [ "node", "server.js" ]
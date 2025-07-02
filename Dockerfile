# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy everything else (code + sessions)
COPY . .

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "index.js"]

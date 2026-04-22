# Use official Node.js image as base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and lock files
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Install dependencies
RUN npm install --production

# Copy app source code
COPY . .

# Expose port (change if your app uses a different port)
EXPOSE 3000

# Allow config.json to be mounted at runtime
VOLUME ["/app/config.json"]

# Start the app
CMD ["npm", "run", "start"]

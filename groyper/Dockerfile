# Use Node.js LTS version
FROM node:20-slim

# Install system dependencies for better-sqlite3 (requires build tools)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY public ./public/
COPY Groyper.json ./

# Create directory for database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/messages.db

# Run the server
CMD ["node", "server.js"]


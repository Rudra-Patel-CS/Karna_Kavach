# Use Debian-based Node.js LTS image
FROM node:20-bookworm-slim

# Install system dependencies (Python 3, pip, and venv)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Create a virtual environment for Python and add it to PATH
# This prevents Bookworm's "externally-managed-environment" error on global pip install
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy package descriptors first to leverage Docker layer caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy requirements.txt and install Python dependencies
COPY karnakavach_backend/requirements.txt ./karnakavach_backend/
RUN pip install --no-cache-dir -r karnakavach_backend/requirements.txt

# Copy all application files
COPY . .

# Build the Vite React frontend and compile server.ts via esbuild
RUN npm run build

# Expose port
EXPOSE 3000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run the Node Express server
CMD ["npm", "start"]

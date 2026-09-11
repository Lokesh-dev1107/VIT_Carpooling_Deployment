# 1. Base image: Official lightweight Node.js 20 on Alpine Linux
FROM node:20-alpine

# 2. Set working directory inside the container
WORKDIR /app

# 3. Copy dependency files first
COPY package*.json ./

# 4. Clean install of production dependencies
RUN npm ci --only=production

# 5. Copy the rest of the backend source code
COPY . .

# 6. Render dynamically sets the PORT environment variable (usually 10000 or 5001)
ENV PORT=5001
EXPOSE 5001

# 7. Start command
CMD ["node", "index.js"]
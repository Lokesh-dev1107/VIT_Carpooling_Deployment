# ==============================================================================
# AFTER HARDENING (Hardened Production Container for Question 2c & Question 1)
# ==============================================================================
# 1. HARDENING STEP 1: Minimal Alpine Linux base image (~150 MB vs 1.1 GB)
# Drastically reduces the attack surface by eliminating hundreds of unused packages
FROM node:20-alpine

# Set production environment flag
ENV NODE_ENV=production
ENV PORT=5001

# 2. HARDENING STEP 2: Create a restricted non-root user and group
# Principle of Least Privilege: Never run production container workloads as root (UID 0)
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

WORKDIR /app

# 3. Copy dependency manifests first (Docker layer caching)
COPY package*.json ./

# 4. HARDENING STEP 3: Install only production dependencies & ignore install scripts
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# 5. Copy backend source code and set ownership to non-root user
COPY --chown=appuser:appgroup . .

# 6. HARDENING STEP 4: Switch execution to unprivileged user
USER appuser

EXPOSE 5001

# 7. Start application
CMD ["node", "index.js"]

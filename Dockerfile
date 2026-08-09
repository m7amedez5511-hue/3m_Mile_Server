FROM node:22-alpine AS base

# -----------------------
# Development Stage
# -----------------------
FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Make the entrypoint script executable (runs on Linux inside the
# container, so this works regardless of the host OS used to build it).
RUN chmod +x ./start.sh

EXPOSE 3000
CMD ["./start.sh"]

# -----------------------
# Production Stage
# -----------------------
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Make the entrypoint script executable
RUN chmod +x ./start.sh

# Run as a non-root user (security hardening)
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["./start.sh"]
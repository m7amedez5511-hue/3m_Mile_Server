FROM node:22-alpine AS base
WORKDIR /app

# -----------------------
# Development Stage
# -----------------------
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .

# Make the entrypoint script executable (runs on Linux inside the
# container, so this works regardless of the host OS used to build it).
RUN chmod +x ./start.sh

EXPOSE 5000
CMD ["./start.sh"]

# -----------------------
# Production Stage
# -----------------------
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/public ./public
COPY --from=build /app/start.sh ./start.sh

# Make the entrypoint script executable
RUN chmod +x ./start.sh

# Run as a non-root user (security hardening)
RUN chown -R node:node /app
USER node

EXPOSE 5000
CMD ["./start.sh"]
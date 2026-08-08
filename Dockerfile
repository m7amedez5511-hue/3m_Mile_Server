FROM node:22-alpine AS base

# -----------------------
# Development Stage
# -----------------------
FROM base AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# -----------------------
# Production Stage
# -----------------------
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Run as a non-root user (security hardening)
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["npm", "start"]
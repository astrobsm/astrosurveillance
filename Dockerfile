# ASTROSURVEILLANCE Edge Server
# Docker image for deployment on DigitalOcean, AWS, or any cloud provider

FROM node:18-alpine

# Install FFmpeg for video recording
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY edge-server/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY edge-server/src ./src
COPY edge-server/config ./config
COPY edge-server/public ./public

# Create directories for recordings and logs
RUN mkdir -p /app/recordings /app/logs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3080
ENV HOST=0.0.0.0

# Database environment variables (set these in your deployment)
ENV DB_HOST=""
ENV DB_PORT=5432
ENV DB_NAME=astrosurveillance
ENV DB_USER=postgres
ENV DB_PASSWORD=""
ENV DB_SSL=false

# Expose port
EXPOSE 3080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3080/api/system/health || exit 1

# Start the server
CMD ["node", "src/index.js"]

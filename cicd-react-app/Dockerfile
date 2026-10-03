# Stage 1: Build React Production Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using clean install
COPY package*.json ./
RUN npm ci || npm install

# Copy source code and compile production bundle
COPY . .
RUN npm run build

# Stage 2: Serve compiled static files with Nginx
FROM nginx:alpine

# Copy custom build output (dist) to Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Start Nginx in foreground mode
CMD ["nginx", "-g", "daemon off;"]
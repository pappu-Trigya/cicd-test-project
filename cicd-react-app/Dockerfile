# Stage 1: Build React Production Assets
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# Stage 2: Serve compiled static files with Nginx
FROM nginx:alpine

# Copy custom Nginx config (listening on port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
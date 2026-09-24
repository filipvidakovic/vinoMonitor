# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite ugrađuje VITE_* promenljive u bundle tokom build-a.
# URL-ovi su adrese koje koristi BROWSER (ne docker mreža).
ARG VITE_AUTH_API_URL=http://localhost:8001
ARG VITE_VINEYARDS_API_URL=http://localhost:8002
ARG VITE_HARVEST_API_URL=http://localhost:8003
ARG VITE_FERMENTATION_API_URL=http://localhost:8004
ARG VITE_IOT_API_URL=http://localhost:8005
ARG VITE_INVENTORY_API_URL=http://localhost:8006
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL \
    VITE_VINEYARDS_API_URL=$VITE_VINEYARDS_API_URL \
    VITE_HARVEST_API_URL=$VITE_HARVEST_API_URL \
    VITE_FERMENTATION_API_URL=$VITE_FERMENTATION_API_URL \
    VITE_IOT_API_URL=$VITE_IOT_API_URL \
    VITE_INVENTORY_API_URL=$VITE_INVENTORY_API_URL

RUN npm run build


# Stage 2: Serve
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

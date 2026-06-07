FROM node:20-alpine AS builder
WORKDIR /app

# Accept Stripe publishable key as build argument
ARG VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

# Debug: show if the build arg was received
RUN echo "VITE_STRIPE_PUBLISHABLE_KEY is: '${VITE_STRIPE_PUBLISHABLE_KEY}'"

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
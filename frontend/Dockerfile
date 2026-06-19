FROM node:20-alpine AS builder
WORKDIR /app

# Accept Stripe publishable keys as build arguments
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY_TEST
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY_TEST=$VITE_STRIPE_PUBLISHABLE_KEY_TEST

# Debug: show if the build args were received
RUN echo "VITE_STRIPE_PUBLISHABLE_KEY is: '${VITE_STRIPE_PUBLISHABLE_KEY}'"
RUN echo "VITE_STRIPE_PUBLISHABLE_KEY_TEST is: '${VITE_STRIPE_PUBLISHABLE_KEY_TEST}'"

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
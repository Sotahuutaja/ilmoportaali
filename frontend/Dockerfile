FROM node:20-alpine AS builder
WORKDIR /app

# Accept Stripe publishable key as build argument
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY

# Debug: show if the build arg was received
RUN echo "REACT_APP_STRIPE_PUBLISHABLE_KEY is: '${REACT_APP_STRIPE_PUBLISHABLE_KEY}'"

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
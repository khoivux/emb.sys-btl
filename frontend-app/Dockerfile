FROM node:18-slim

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

COPY . .

# Expose Vite port (As configured in vite.config.js)
EXPOSE 3000

# Run vite with host 0.0.0.0 so it's accessible outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

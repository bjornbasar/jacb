# Dockerfile - jacb (lightweight version)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev && \
    apk update && apk add curl && \
    rm -rf /var/cache/apk/*

# Copy remaining project files
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the bot port
EXPOSE 3000

# Start the chatbot
CMD ["npm", "start"]

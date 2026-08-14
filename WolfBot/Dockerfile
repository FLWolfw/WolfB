FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app


# Install app dependencies.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Bundle app source
COPY . .

# Expose the health check port from src/app.js
EXPOSE 3000

# Start the bot
CMD [ "npm", "start" ]

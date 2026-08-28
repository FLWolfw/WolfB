FROM node:20-alpine

WORKDIR /usr/src/app

# Music runtime: yt-dlp resolves/searches media sources and ffmpeg converts
# the audio stream into a format Discord's voice player can consume.
RUN apk add --no-cache ffmpeg yt-dlp

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]

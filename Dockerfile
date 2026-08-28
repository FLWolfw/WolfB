FROM node:24-alpine

WORKDIR /usr/src/app

# Music runtime: yt-dlp resolves/searches media sources and ffmpeg converts
# the audio stream into a format Discord's voice player can consume.
# Deno + yt-dlp-ejs are required by current YouTube extraction flows.
RUN apk add --no-cache ffmpeg yt-dlp deno yt-dlp-ejs

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]

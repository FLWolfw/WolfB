FROM node:22-alpine

WORKDIR /usr/src/app

# Music runtime: use a current PyPI yt-dlp build because the Alpine
# repository version can lag behind YouTube extractor changes.
# Deno + yt-dlp-ejs provide the JavaScript challenge runtime for YouTube.
RUN apk add --no-cache ffmpeg deno python3 py3-pip \
  && python3 -m pip install --break-system-packages --no-cache-dir -U "yt-dlp[default]"

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD [ "npm", "start" ]

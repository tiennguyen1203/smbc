FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    && rm -rf /var/cache/apk/* \
    && ffmpeg -version \
    && ffprobe -version

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 5000

CMD ["yarn", "dev"] 
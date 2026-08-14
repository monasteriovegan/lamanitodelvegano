FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev \
  && npx playwright install --with-deps chromium \
  && apt-get update \
  && apt-get install -y --no-install-recommends xvfb x11vnc fluxbox novnc websockify \
  && rm -rf /var/lib/apt/lists/*
COPY src ./src
COPY start-supervised.sh ./start-supervised.sh
RUN chmod +x ./start-supervised.sh
ENV NODE_ENV=production
ENV DISPLAY=:99
CMD ["./start-supervised.sh"]

FROM node:20-slim

# Install dependencies Playwright needs
RUN apt-get update && apt-get install -y \
  wget \
  gnupg \
  ca-certificates \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libxshmfence1 \
  libu2f-udev \
  libdrm2 \
  libxkbcommon0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]

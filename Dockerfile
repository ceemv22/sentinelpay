FROM node:22

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-requests \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN cd api && npm install

EXPOSE 8080

ENV PORT=8080

CMD ["sh", "-c", "cd api && npx prisma db push --skip-generate --accept-data-loss && node index.js"]

FROM node:22

WORKDIR /app

COPY . .

RUN cd api && npm install --omit=dev

EXPOSE 8080

ENV PORT=8080

CMD ["sh", "-c", "cd api && node index.js"]

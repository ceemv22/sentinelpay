FROM node:22

RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

RUN pip3 install requests --break-system-packages

WORKDIR /app

COPY . .

RUN cd api && npm install

EXPOSE 8080

ENV PORT=8080

CMD ["node", "api/index.js"]
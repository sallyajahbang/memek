FROM node:18-bullseye

RUN apt-get update && apt-get install -y openjdk-17-jre-headless wget && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

RUN wget -O server.jar https://piston-data.mojang.com/v1/objects/84102a9f138128f78d219430a49f82819e487a38/server.jar

COPY . .

EXPOSE 3000
EXPOSE 25565

CMD ["npm", "start"]

FROM node:18.16.1-slim

WORKDIR /opt/bifrost/energy-community-controller-connector/

# install docker
RUN apt-get update
RUN apt-get install ca-certificates curl -y
RUN install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
RUN chmod a+r /etc/apt/keyrings/docker.asc
RUN echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt-get update
RUN apt-get install docker-ce docker-ce-cli containerd.io -y

# set up node environment
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# copy module files
COPY src/ ./src/
COPY fragment/ ./fragment/

RUN npm run tsc

STOPSIGNAL SIGINT

# don't use npm directly, since it will not forward SIGINT
CMD ["node", "./build/energyCommunityControllerConnector.js"]
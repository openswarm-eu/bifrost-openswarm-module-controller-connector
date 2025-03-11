# Energy Community Controller Connector

This project contains the BIFROST module to connect the [openswarm energy community controller](https://code.siemens.com/openswarm/energy-community-controller) to the BIFROST virtual testbed.

Ensure, that you either have the openswarm energy community controller docker images

* cr.siemens.com/openswarm/energy-community-controller/charger 
* cr.siemens.com/openswarm/energy-community-controller/pv

stored locally or access to the docker repo.

## Compile and run your module 

1. Install [Node.JS](https://nodejs.org/en) (tested with version 18.20.2, npm 10.5.0).

2. Install Node modules
```sh
npm install
```

3. Start BIFROST ZERO.
```sh
docker-compose -f ./docker/docker-compose_dev.yml up -d
```

4. Run the module
```sh
npm run start:docker
```

The bifrost ui is reachable under [http://localhost:9091](http://localhost:9091)

## Run energy community controller connector in docker
```sh
docker-compose -f ./docker/docker-compose.yml up -d --build
```

The BIFROST ui is reachable under [http://localhost:9091](http://localhost:9091)
# Energy Community Controller Connector

This project contains the BIFROST module to connect the [openswarm energy community controller](https://code.siemens.com/openswarm/energy-community-controller) to the BIFROST virtual testbed.

Ensure, that you either have the openswarm energy community controller docker images

* cr.siemens.com/openswarm/energy-community-controller/charger 
* cr.siemens.com/openswarm/energy-community-controller/pv

stored locally or access to the docker repo.

## Compile and run your module 

1. Install [Node.JS](https://nodejs.org/en) (tested with version 20.19.1, npm 10.8.2).

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

## Test Story

A simple test story is also provided here, just zip the contents of the [`./demo/bsx_raw/OpenSwarmCity/`](./demo/bsx_raw/OpenSwarmCity/) folder and import this archive via the "Import Story" button on the start screen of the BIFROST ui. 

You can also use the contents of the files in the [`./demo/base-stories/`](./demo/base-stories/) to create only the structures in your experiment. Use CTRL+A, CTRL+C to copy the contents of the file to the clipboard and paste it into an empty experiment in BIFROST.
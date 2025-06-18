# Energy Community Controller Connector

This project contains the BIFROST module to connect the [openswarm energy community controller](https://code.siemens.com/openswarm/energy-community-controller) to the BIFROST virtual testbed.

Ensure, that you either have the openswarm energy community controller docker images

* cr.siemens.com/openswarm/energy-community-controller/charger 
* cr.siemens.com/openswarm/energy-community-controller/pv
* cr.siemens.com/openswarm/energy-community-controller/sensor

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

## Release a New Version

**ATTENTION**: Be sure before releasing, that all components are tested with the tagged version!

For release a separate branch `release` is used. By merging your commits to this branch, make a release commit (see below), tag the new version and pushing the tag & release commit a new image of this module and data-handler is built.
Please stick to following procedure:

1. Merge all commits to be released into the `release` branch:
    ```bash
    git checkout release
    git merge main
    ```
2. Make a release commit (maybe with a short description)
    * increase the version number [in section "Current Version" of this README](#current-version)
    * commit this change with
    ```bash
    git add *
    git commit -m "CHORE: release new version"
    ```
3. Tag this commit (and move the `latest` tag to this commit)
    ```bash
    git tag -d latest
    git push origin :refs/tags/latest
    git tag -a vX.Y.Z -m "Add an optional tag description here"
    git tag -a latest -m "Latest tagged version"
    ```
4. Push the commit and tag
    ```bash
    git push
    git push origin vX.Y.Z
    git push origin latest
    ```
    After pushing the tag the CI/CD pipeline is initiated and a new container image is built.
5. Continue working on the `main` branch
     ```bash
    git checkout main
    ```

There is a PowerShell script `releaseNewVersion.ps1` which does the above in one step. Use it with care!

## OpenSwarm github Repository
Here some commands which where used to mirror the code.siemens.com repository to the openswarm github repository:
```sh
git remote add openswarmgithub https://github.com/openswarm-eu/bifrost-openswarm-module-controller-connector.git
git push openswarmgithub main
git push openswarmgithub release
git push openswarmgithub vX.Y.Z
git push openswarmgithub :refs/tags/latest
git push openswarmgithub latest
```

## Current Version

v2.0.0
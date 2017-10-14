# Hub Docker Build
Bind OSX terminal aliases for building and mounting the Hub's rest-backend and UI for development. 
<br> The rest-backend is hosted on port `443` and can be accessed at `https://localhost`. 
<br> The UI development proxy is hosted on port `8443` and is accessed at `https://localhost:8443`.

## To bind aliases:
1. Clone and install with `git clone https://github.com/blackducksoftware/hub-ui-build.git && cd hub-ui-build && npm install`
2. Run `npm start`

## Aliases:
`hub-up`: Builds and mounts the Hub's docker containers
###### Build Options:
  &nbsp;&nbsp;&nbsp;&nbsp;```--prune-volumes, -v```: Prune volumes
<br>&nbsp;&nbsp;&nbsp;&nbsp;```--prune-images, -i```: Prune images
<br>&nbsp;&nbsp;&nbsp;&nbsp;```--clean-build, -c```: Build the rest-backend with the `clean` gradle task, for a slower but more reliable build
<br>&nbsp;&nbsp;&nbsp;&nbsp;```--skip-build, -s```: Don't make a rest-backend build, useful for unmounting / remounting containers
<br>&nbsp;&nbsp;&nbsp;&nbsp;```--remove-containers, -r```: Remove currently mounted docker containers

`ui-up`: Builds the UI and launches the development proxy

`ui-dev`: Equivalent to running both `hub-up` and `ui-up`

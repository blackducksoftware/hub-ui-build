# Hub Docker Build
### Compatible with the UI development proxy
This script binds Terminal aliases for building and mounting the Hub to ensure compatibility with UI dev proxy

## To bind aliases:
1. Clone and install with `git clone https://github.com/sutkh/hub-ui-build.git && cd hub-ui-build && npm install`
2. Run `npm start`

## Hub Build Options:
```--prune-volumes, -v```: Prune volumes
<br>```--prune-images, -i```: Prune images
<br>```--dirty-build, -d```: Build the rest-backend without the `clean` gradle task, for a faster build
<br>```--skip-build, -s```: Don't make a rest-backend build, useful for unmounting / remounting containers

## Aliases:
`hub-up`: Builds and mounts the Hub's docker containers, and makes modifications to the Tomcat and docker-compose configurations to host the rest-backend's web app on port 8080

`ui-up`: Builds the UI and launches the development proxy

`ui-dev`: Equivalent to running both `hub-up` and `ui-up`

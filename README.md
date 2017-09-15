# Hub Docker Build
### Compatible with the UI development proxy
Builds and mounts the Hub's docker containers, and makes modifications to the Tomcat and docker-compose configurations to host the rest-backend's web app on port 8080

## To run:
1. Clone and install into the parent directory of the rest-backend repository. 
<br><b>** NOTE **</b> This step is important, the script assumes that it has been installed in the correct location.
2. Run ```npm start```

## Options:
```--prune-vols, -v```: Prune volumes
<br>```--prune-imgs, -i```: Prune images
<br>```--dirty-build, -d```: Build the rest-backend without the `clean` gradle task, for a faster build
<br>```--skip-build, -s```: Don't make a rest-backend build, useful for unmounting / remounting containers

## Recommended for OSX users
Run ```npm run aliases && source ~/.bashrc```
<br> This binds the `hub-up`, `ui-up` and `ui-dev` aliases

`hub-up`: Runs the Hub's docker build, creates and mounts new containers as necessary. This is equivalent to `npm start`

`ui-up`: Builds the UI and launches the development proxy
<br><b> ** NOTE ** </b> This alias assumes that the ui repo is installed in the same directory as the rest-backend

`ui-dev`: Equivalent of running both `hub-up` and `ui-up`
<br><b> ** NOTE ** </b> This alias assumes that the ui repo is installed in the same directory as the rest-backend

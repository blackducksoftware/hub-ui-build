# Custom Hub Build for compatibility with the UI dev proxy
Build and mount the Hub's docker containers, and make modifications to the Apache Tomcat and Docker compose configurations so that local Hub instances are friendly with the UI development proxy

## To run:
1. Clone and install into the parent directory of the rest-backend repository. <b>** NOTE **</b> This step is important, the script assumes that it has been installed in the correct location.
2. Run ```npm start```

## Options:
```--clean-vols, -v```: Remove volumes of previous docker containers
<br>```--clean-imgs, -i```: Remove all blackducksoftware/hub images

## Recommended
Run ```npm run aliases && source ~/.bashrc```
<br> This binds the `hub-up` and `hub-dev` aliases
<br> `hub-up` allows the Hub's docker build to be run globally
<br> `hub-dev` Runs the docker build, builds the UI, and launches the UI development proxy

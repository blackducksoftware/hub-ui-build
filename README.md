# hub-build-script
Simple script to build and mount the Hub's docker containers, and make modifications to the Apache Tomcat and Docker compose configurations to so that local Hub instances are friendly with the UI development proxy


# To run:
1. Clone and install into the parent directory of the rest-backend repository
2. Run ```npm start```

# Options:
```--clean-vols, -v```: Remove volumes of previous docker containers
```--clean-imgs, -v```: Remove all blackducksoftware/hub images
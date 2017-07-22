# Custom Hub Build for compatibility with the UI dev proxy
Build and mount the Hub's docker containers, and make modifications to the Apache Tomcat and Docker compose configurations so that local Hub instances are friendly with the UI development proxy

## To run:
1. Clone and install into the parent directory of the rest-backend repository
2. Run ```npm start```

## Options:
```--clean-vols, -v```: Remove volumes of previous docker containers
<br>```--clean-imgs, -i```: Remove all blackducksoftware/hub images

## Recommended usage
Add this alias to your .bash_profile:
<br>```alias hub-up='node {ABS_PATH}/hub-ui-build/hub-up.js'```

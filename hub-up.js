const buildStart = new Date();

const path = require('path');
const yaml = require('js-yaml');
const humanize = require('humanize-duration');
const { argv } = require('yargs');
const fsProm = require('./lib/fs-promise');
const log = require('./lib/log');
const execute = require('./lib/execute');

const doCleanImages = argv['clean-imgs'] || argv.i;
const doCleanVolumes = argv['clean-vols'] || argv.v;
const doPruneImages = argv['prune-imgs'] || argv.p;

const repoDir = path.resolve(__dirname, '../rest-backend');
const composeDir = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose');
let mountAttempts = 0;

// Use http instead of https, because we can't bind both the webapp and the dev proxy to port 443
const modifyTomcatConfig = () => {
    const filePath = path.resolve(repoDir, 'docker/blackducksoftware/hub-tomcat/server.xml');

    log.command('Modify Apache Tomcat server.xml config\n');

    return fsProm.filterFile(filePath, (line) => {
            const trimmedLine = line.trim();        
            // We want to remove these lines from the config file
            return ['scheme="https"', 'proxyPort="443"']
                .every(configLine => configLine !== trimmedLine);
        })
        .then((content) => fsProm.writeFile(filePath, content));
};

// Expose port 8080 on the webapp container, because that's the port the dev proxy uses
const modifyDockerConfig = () => {
    const filePath = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose/docker-compose.yml');

    log.command('Modify Docker compose config\n');    

    return fsProm.readFile(filePath)
        .then((fileContent) => {
            const config = yaml.safeLoad(fileContent, 'utf8');
            const ports = config.services.webapp.ports;

            if (!ports.includes('8080:8080')) {
                ports.push('8080:8080');
            }

            const serializedConfig = yaml.safeDump(config, {
                flowLevel: 0
            });

            return fsProm.writeFile(filePath, serializedConfig);
        });
};

const pruneDockerImages = () => {
    if (!doPruneImages) {
        return;
    }

    return getOrphanImageHashes()
        .then((hashes) => hashes && execute('docker rmi', {
            args: [hashes]
        }));
};

const getOrphanImageHashes = () => {
    return execute('docker images', {
            silent: true,
            args: [
                '-f dangling=true',
                '-q'
            ]
        })
        .then((hashBlock) => hashBlock.trim() && hashBlock.split('\n').join(' '));        
};

const mountHubContainers = () => {
    return execute('docker-compose', {
            args: [
                'up',
                '-d'
            ],
            cwd: composeDir
        })
        .catch(() => {
            mountAttempts++;
            log.error('Docker containers failed to mount.\n');
            log('Removing all old containers and re-creating from new images.\n');

            if (mountAttempts < 2) {
                return removeHubContainers()
                    .then(() => mountHubContainers());
            }
        });
};

const buildRestBackend = () => {
    return execute('./gradlew', {
        args: [
            'assemble',
            'docker',
            'docker:hub-docker:build'
        ], 
        cwd: repoDir
    });
};

const removeHubImages = () => {
    return execute('docker rmi', {
            args: [
                "$(docker images | grep blackducksoftware\/hub | awk '{print $3}')"
            ]
        })
        .catch(() => {
            log('There are no Hub docker images to remove\n');
        });
};

const removeHubContainers = () => {
    const args = ['down'];

    if (doCleanVolumes) {
        args.push('-v');
    }

    return fsProm.isDirectory(composeDir)
        .catch(() => {
            log('Rest-backend hasn\'t been previously built\n');
            return false;
        })    
        .then((isDir) => isDir && execute('docker-compose', {
            args,
            cwd: composeDir
        }))
};

const pollContainerStatus = () => {
    const interval = 5000;
    const timeout = 180000;
    const start = new Date();

    log.command('Polling for container health status\n');

    const checkStatus = () => {
        execute('docker ps', {
                silent: true
            })
            .then((output) => {
                const lines = output.trim().split('\n');
                const containers = lines.slice(1);
                const areContainersHealthy = containers
                    .every(container => container.includes('healthy'));
                const elapsedTime = new Date() - start;

                if (areContainersHealthy) {
                    log('All containers are healthy');
                    log(`Total setup time: ${humanize(new Date() - buildStart)}`);
                } else if (elapsedTime > timeout) {
                    log.error('Build timed out waiting for a healthy status for all docker containers');
                    process.stderr.write("\007");
                } else {
                    setTimeout(checkStatus, interval);
                }
            });
    };

    checkStatus();
};

Promise.all([
        modifyTomcatConfig(),
        doCleanVolumes && removeHubContainers()
    ])
    .then(() => doCleanImages && removeHubImages())
    .then(() => buildRestBackend())
    // Modify the docker compose configuration and
    .then(() => modifyDockerConfig())
    // Run the new docker images
    .then(() => mountHubContainers())
    .then(() => pruneDockerImages())
    .then(() => pollContainerStatus())
    .catch(err => err && log.error(err));

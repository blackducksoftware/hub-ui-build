const buildStart = new Date();

const path = require('path');
const yaml = require('js-yaml');
const humanize = require('humanize-duration');
const { argv } = require('yargs');
const fsProm = require('./lib/fs-promise');
const log = require('./lib/log');
const execute = require('./lib/execute');
const chalk = require('chalk');

const doDirtyBuild = argv['dirty-build'] || argv.d;
const skipBuild = argv['skip-build'] || argv.s;
const doPruneImages = argv['prune-imgs'] || argv.i;
const doPruneVolumes = argv['prune-vols'] || argv.v;

const repoDir = path.resolve(__dirname, '../rest-backend');
const composeDir = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose');
const tomcatConfigPath = path.resolve(repoDir, 'docker/blackducksoftware/hub-tomcat/server.xml');

let mountAttempts = 0;
let tomcatOriginalConfig = '';
let isConfigModified = false;

// Use http instead of https, because we can't bind both the webapp and the dev proxy to port 443
const modifyTomcatConfig = () => {
    log.command('Modify Apache Tomcat server.xml config\n');

    return fsProm.filterFile(tomcatConfigPath, (line) => {
            const trimmedLine = line.trim();

            tomcatOriginalConfig += line + '\n';

            // We want to remove these lines from the config file
            return ['scheme="https"', 'proxyPort="443"']
                .every(configLine => configLine !== trimmedLine);
        })
        .then((content) => fsProm.writeFile(tomcatConfigPath, content))
        .then(() => { isConfigModified = true; })
};

const restoreTomcatConfig = () => {
    log.command('Restore Apache Tomcat server.xml config\n');
    return fsProm.writeFile(tomcatConfigPath, tomcatOriginalConfig)
        .then(() => { isConfigModified = false; })
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
    return execute('docker image prune', {
        args: ['-f']
    });
};

const pruneDockerVolumes = () => {
    return execute('docker volume prune', {
        args: ['-f']
    });
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

            if (mountAttempts < 2) {
                log('Removing all old containers and re-creating from new images.\n');
                return removeHubContainers()
                    .then(() => mountHubContainers());
            }
        });
};

const buildRestBackend = () => {
    const args = (doDirtyBuild ? [] : ['clean']).concat(
        'docker',
        'docker:hub-docker:build'
    );

    return execute('./gradlew', {
        args,
        cwd: repoDir
    });
};

const removeHubContainers = () => {
    const args = ['down'];

    if (doPruneVolumes) {
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
        }));
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
                const isContainerUnhealthy = containers
                    .some(container => container.includes('(unhealthy)'));
                const isContainerRestarting = containers
                    .some(container => container.includes('Restarting ('));
                const areContainersHealthy = !isContainerUnhealthy && containers
                    .every(container => container.includes('(healthy)'));
                const elapsedTime = new Date() - start;

                if (isContainerRestarting || isContainerUnhealthy) {
                    log.error(`One or more containers is unhealthy or restarting, try pruning all images and volumes with ${log.getCommandColor('hub-up -iv')}\n`);
                    process.stderr.write('\007');
                    if (isContainerRestarting) { logRestartingContainers(); }
                    if (isContainerUnhealthy) { logUnhealthyContainers(); }
                } else if (areContainersHealthy) {
                    log('All containers are healthy');
                    log(`Total setup time: ${humanize(new Date() - buildStart)}`);
                } else if (elapsedTime > timeout) {
                    log.error('Build timed out waiting for a healthy status for all docker containers');
                    process.stderr.write('\007');
                } else {
                    setTimeout(checkStatus, interval);
                }
            });
    };

    setTimeout(checkStatus, interval);
};

const getUnhealthyContainers = () => {
    return getContainers('(unhealthy)');
};

const getRestartingContainers = () => {
    return getContainers('Restarting (');
};

// Get the name and hash of containers matching this pattern in their `docker ps` status
const getContainers = (pattern) => {
    return execute(`docker ps | grep \'${pattern}\' | awk \'{print $1" "$2}\'`, {
            silent: true
        })
        .then((containersData) => {
            return containersData
            .trim()
            .split('\n')
            .map(containerData => {
                const [hash, name] = containerData.split(' ');
                return {
                    hash,
                    name
                };
            });
        });
};

const logUnhealthyContainers = () => {
    return getUnhealthyContainers()
        .then(containers => {
            containers.forEach(({ name, hash }) => {
                log.error(`Container: ${name} is unhealthy`);
                log.error(`Run ${log.getCommandColor(`docker logs ${hash} --tail 50`)} to see the container's last 50 log entries\n`);
            });
        });
};

const logRestartingContainers = () => {
    return getRestartingContainers()
        .then(containers => {
            containers.forEach(({ name, hash }) => {
                log.error(`Container: ${name} is restarting`);
                log.error(`Run ${log.getCommandColor(`docker logs ${hash} --tail 50`)} to see the container's last 50 log entries\n`);
            });
        });
};

Promise.all([
        !skipBuild && modifyTomcatConfig(),
        (doPruneVolumes || doPruneImages) && removeHubContainers()
    ])
    .then(() => doPruneImages && pruneDockerImages())
    .then(() => doPruneVolumes && pruneDockerVolumes())
    .then(() => !skipBuild && buildRestBackend())
    .then(() => Promise.all([
        // Restore the server.xml file to its original state
        !skipBuild && restoreTomcatConfig(),
        // Modify the docker compose configuration
        modifyDockerConfig()
    ]))
    // Run the new docker images
    .then(() => mountHubContainers())
    .then(() => pollContainerStatus())
    .catch(err => err && log.error(err));

process.on('SIGINT', () => {
    if (isConfigModified) {
        restoreTomcatConfig();
    }
});

const buildStart = new Date();
const path = require('path');
const log = require('./lib/log');
const fs = require('./lib/fs-promise');
const execute = require('./lib/execute');
const dockerUtil = require('./lib/docker-util');
const ContainerTable = require('./lib/container-table');
const Containers = require('./lib/containers');

const loadConfig = () => {
    try {
        require('dotenv-safe').load({
            path: path.resolve(__dirname, '.env'),
            sample: path.resolve(__dirname, '.env.example')
        });
    } catch (err) {
        log.error(`Environment configuration is invalid or not found. Please go the hub-ui-build directory and run ${log.getCommandColor('npm i && npm start')}`);
        process.exit(1);
    }

    const argv = require('yargs')
        .option('clean-build', {
            alias: 'c',
            describe: 'Build the rest-backend with the `clean` gradle task, for a slower but more reliable build',
            type: 'boolean',
            default: false
        })
        .option('skip-build', {
            alias: 's',
            describe: 'Don\'t make a rest-backend build, useful for unmounting / remounting containers',
            type: 'boolean',
            default: false
        })
        .option('prune-images', {
            alias: 'i',
            describe: 'Prune docker images. We remove the currently mounted docker containers before pruning.',
            type: 'boolean',
            default: false
        })
        .option('prune-volumes', {
            alias: 'v',
            describe: 'Prune docker volumes. We remove the currently mounted docker containers before pruning.',
            type: 'boolean',
            default: false
        })
        .option('remove-containers', {
            alias: 'r',
            describe: 'Remove currently mounted docker containers',
            type: 'boolean',
            default: false
        })
        .help()
        .argv;

    return Object.assign(
        {
            hubRootDir: process.env.HUB_REPO_DIR,
            composeDir: path.resolve(process.env.HUB_REPO_DIR, 'docker/hub-docker/build/docker-compose/dev/docker-compose'),
            serverXmlPath: path.resolve(process.env.HUB_REPO_DIR, 'docker/blackducksoftware/hub-tomcat/server.xml'),
            doRemoveContainers: argv.removeContainers || argv.pruneImages || argv.pruneVolumes
        },
        argv
    );
};

const {
    hubRootDir,
    composeDir,
    serverXmlPath,
    doRemoveContainers,
    pruneVolumes: doPruneVolumes,
    pruneImages: doPruneImages,
    skipBuild: doSkipBuild,
    cleanBuild: doCleanBuild
} = loadConfig();
let originalServerXml = '';
let isServerXmlModified = false;
const hubContainers = new Containers({ composeDir });

// Use http instead of https, because we can't bind both the webapp and the dev proxy to port 443
const modifyTomcatConfig = () => {
    log.command('Modify Apache Tomcat server.xml config\n');

    return fs.filterFile(serverXmlPath, (line) => {
            const trimmedLine = line.trim();

            originalServerXml += line + '\n';

            // We want to remove these lines from the config file
            return ['scheme="https"', 'proxyPort="443"']
                .every(configLine => configLine !== trimmedLine);
        })
        .then((content) => fs.writeFile(serverXmlPath, content))
        .then(() => { isServerXmlModified = true; })
};

const restoreTomcatConfig = () => {
    if (!isServerXmlModified) {
        return;
    }

    log.command('Restore Apache Tomcat server.xml config\n');

    return fs.writeFile(serverXmlPath, originalServerXml)
        .then(() => { isServerXmlModified = false; })
};

// Expose port 8080 on the webapp container, because that's the port the dev proxy uses
const modifyDockerConfig = () => {
    const yaml = require('js-yaml');
    const filePath = path.resolve(composeDir, 'docker-compose.yml');

    log.command('Modify Docker compose config\n');

    return fs.readFile(filePath)
        .then((fileContent) => {
            const config = yaml.safeLoad(fileContent, 'utf8');
            const ports = config.services.webapp.ports;

            if (!ports.includes('8080:8080')) {
                ports.push('8080:8080');
            }

            const serializedConfig = yaml.safeDump(config, {
                flowLevel: 0
            });

            return fs.writeFile(filePath, serializedConfig);
        });
};

const buildRestBackend = () => {
    const args = (doCleanBuild ? ['clean'] : []).concat(
        'docker',
        'docker:hub-docker:build'
    );

    return execute('./gradlew', {
        args,
        cwd: hubRootDir
    });
};

const pollContainerStatus = () => {
    const humanize = require('humanize-duration');
    const start = new Date();
    const interval = 3000;
    const timeout = 240000;
    let timeoutId;

    log.command('Polling for container health status\n');
    
    const containerTable = new ContainerTable();
    containerTable.start();

    const checkStatus = () => {
        const elapsedTime = new Date() - start;

        if (elapsedTime < timeout) {
            timeoutId = setTimeout(checkStatus, interval);
        } else {
            log.error(`Timed out waiting ${humanize(timeout)} for a healthy status for all docker containers`);
            process.stderr.write('\007');
            return;
        }

        Containers.get()
            .then((containers) => {
                const nameMap = Containers.groupByProperty(containers, 'name');
                return containerTable.render(nameMap)
                    .then(() => containers);
            })
            .then((containers) => {
                const { unhealthy, restarting, starting } = Containers.groupByProperty(containers, 'status');
                const doContinuePolling = starting && !unhealthy && !restarting;

                if (doContinuePolling) {
                    return;
                }

                containerTable.stop();
                clearTimeout(timeoutId);

                if (unhealthy || restarting) {
                    log.error(`\nOne or more containers is unhealthy or restarting, try pruning all images and volumes with ${log.getCommandColor('hub-up -ivs')}\n`);
                    process.stderr.write('\007');
                    logInvalidContainers([].concat(unhealthy || [], restarting || []));
                } else {
                    log(`Total setup time: ${humanize(new Date() - buildStart)}`);
                }
            })
            // Very occasionally, `docker ps` will exit with a non-zero status code
            .catch((err) => { console.error(err); });

    };

    checkStatus();
};


const logInvalidContainers = (containers) => {
    containers.forEach(({ name, id, status }) => {
        log.error(`Container: ${name} is ${status}`);
        log.error(`Run ${log.getCommandColor(`docker logs ${id} --tail 50`)} to see the container's last 50 log entries\n`);
    });
};

Promise.all([
        !doSkipBuild && modifyTomcatConfig(),
        doRemoveContainers && hubContainers.remove(doPruneVolumes)
    ])
    .then(() => doPruneImages && dockerUtil.pruneImages())
    .then(() => doPruneVolumes && dockerUtil.pruneVolumes())
    .then(() => !doSkipBuild && buildRestBackend())
    .then(() => !doSkipBuild && Promise.all([
        // Restore the server.xml file to its original state
        restoreTomcatConfig(),
        // Modify the docker compose configuration
        modifyDockerConfig()
    ]))
    // Run the new docker images
    .then(() => hubContainers.mount())
    .then(() => pollContainerStatus())
    .catch((err) => {
        log.error(err);
        restoreTomcatConfig();
    });

process.on('SIGINT', restoreTomcatConfig);

const buildStart = new Date();
const path = require('path');
const log = require('./lib/log');

try {
    require('dotenv-safe').load({
        path: path.resolve(__dirname, '.env'),
        sample: path.resolve(__dirname, '.env.example')
    });
} catch (err) {
    log.error(`Environment configuration is invalid or not found. Please go the hub-ui-build directory and run ${log.getCommandColor('npm i && npm start')}`);
    return;
}

const yaml = require('js-yaml');
const humanize = require('humanize-duration');
const fs = require('./lib/fs-promise');
const execute = require('./lib/execute');
const dockerUtil = require('./lib/docker-util');
const ContainerTable = require('./lib/container-table');
const Containers = require('./lib/containers');

const { argv } = require('yargs');
const doDirtyBuild = argv['dirty-build'] || argv.d;
const skipBuild = argv['skip-build'] || argv.s;
const doPruneImages = argv['prune-imgs'] || argv.i;
const doPruneVolumes = argv['prune-vols'] || argv.v;
const doRemoveContainers = (argv['remove-containers'] || argv.r) || doPruneImages || doPruneVolumes;

const repoDir = process.env.HUB_REPO_DIR;
const tomcatConfigPath = path.resolve(repoDir, 'docker/blackducksoftware/hub-tomcat/server.xml');

let tomcatOriginalConfig = '';
let isConfigModified = false;

const hubContainers = new Containers({
    composeDir: path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose') 
});

// Use http instead of https, because we can't bind both the webapp and the dev proxy to port 443
const modifyTomcatConfig = () => {
    log.command('Modify Apache Tomcat server.xml config\n');

    return fs.filterFile(tomcatConfigPath, (line) => {
            const trimmedLine = line.trim();

            tomcatOriginalConfig += line + '\n';

            // We want to remove these lines from the config file
            return ['scheme="https"', 'proxyPort="443"']
                .every(configLine => configLine !== trimmedLine);
        })
        .then((content) => fs.writeFile(tomcatConfigPath, content))
        .then(() => { isConfigModified = true; })
};

const restoreTomcatConfig = () => {
    if (!isConfigModified) {
        return;
    }

    log.command('Restore Apache Tomcat server.xml config\n');

    return fs.writeFile(tomcatConfigPath, tomcatOriginalConfig)
        .then(() => { isConfigModified = false; })
};

// Expose port 8080 on the webapp container, because that's the port the dev proxy uses
const modifyDockerConfig = () => {
    const filePath = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose/docker-compose.yml');

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
    const args = (doDirtyBuild ? [] : ['clean']).concat(
        'docker',
        'docker:hub-docker:build'
    );

    return execute('./gradlew', {
        args,
        cwd: repoDir
    });
};

const pollContainerStatus = () => {
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

        Promise.all([
            Containers.get({ byGrouping: 'status' }),
            containerTable.render()
        ])
            .then(([{ unhealthy, restarting, starting }]) => {
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
        !skipBuild && modifyTomcatConfig(),
        doRemoveContainers && hubContainers.remove(doPruneVolumes)
    ])
    .then(() => doPruneImages && dockerUtil.pruneImages())
    .then(() => doPruneVolumes && dockerUtil.pruneVolumes())
    .then(() => !skipBuild && buildRestBackend())
    .then(() => Promise.all([
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

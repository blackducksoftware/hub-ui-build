const buildStart = new Date();
const path = require('path');
const log = require('./lib/log');
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
        .alias('help', 'h')
        .argv;

    return Object.assign(
        {
            hubRootDir: process.env.HUB_REPO_DIR,
            composeDir: path.resolve(process.env.HUB_REPO_DIR, 'docker/hub-docker/build/docker-compose/dev/docker-compose'),
            doRemoveContainers: argv.removeContainers || argv.pruneImages || argv.pruneVolumes
        },
        argv
    );
};

const {
    hubRootDir,
    composeDir,
    doRemoveContainers,
    pruneVolumes: doPruneVolumes,
    pruneImages: doPruneImages,
    skipBuild: doSkipBuild,
    cleanBuild: doCleanBuild
} = loadConfig();
const hubContainers = new Containers({ composeDir });

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

Promise.resolve(doRemoveContainers && hubContainers.remove(doPruneVolumes))
    .then(() => doPruneImages && dockerUtil.pruneImages())
    .then(() => doPruneVolumes && dockerUtil.pruneVolumes())
    .then(() => !doSkipBuild && buildRestBackend())
    // Run the new docker images
    .then(() => hubContainers.mount())
    .then(() => pollContainerStatus())
    .catch(log.error);

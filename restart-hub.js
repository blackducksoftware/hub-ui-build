const buildStart = new Date();

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const yaml = require('js-yaml');
const chalk = require('chalk');
const humanize = require('humanize-duration');
const { argv } = require('yargs');

const doCleanImages = argv['clean-imgs'] || argv.i;
const doCleanVolumes = argv['clean-vols'] || argv.v;

const repoDir = path.resolve(__dirname, '../rest-backend');
const composeDir = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose');

const log = (msg) => {
    console.log(chalk.bgCyan.black(msg));
};

const logCommand = (msg) => {
    console.log(chalk.bgYellowBright.black.bold(msg));
};

const logData = (msg) => {
    process.stdout.write(msg);
};

const logError = (msg) => {
    console.log(chalk.red(msg));
};

const isDirectory = (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.stat(dirPath, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stats.isDirectory());
        });
    });
};

const writeFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
};

const readFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });
};

// Spawn another process, run a command, and return the result
const execute = (command, opts = {}) => {
    const {
        args = [], 
        cwd = repoDir, 
        listener = () => {},
        silent = false
    } = opts;
    const childProc = spawn(command, args, { cwd, shell: true });
    let output = '';

    if (!silent) {
        logCommand(`execute: ${command} ${args.join(' ')}\n`);    
    }

    childProc.stdout.on('data', (buffer) => {
        const data = buffer.toString();

        if (data && !silent) {
            logData(data);
        }

        listener(data);
        output += data;            
    });

    childProc.stderr.on('data', (buffer) => {
        const data = buffer.toString();
        if (data && !silent) {
            logData(data);
        }
    });

    return new Promise((resolve, reject) => {
        childProc.on('exit', (code) => {
            if (!silent) {
                logData('\n');
            }

            if (code === 0) {
                resolve(output);
            }

            reject(`Error running: ${command} ${args.join(' ')}`);
        });
    });
};

// Use http instead of https, because we can't bind both the webapp and the dev proxy to port 443
const modifyTomcatConfig = () => {
    const filePath = path.resolve(repoDir, 'docker/blackducksoftware/hub-tomcat/server.xml');
    const reader = readline.createInterface({
        input: fs.createReadStream(filePath)
    });
    let fileContent = '';    

    logCommand('Modify Apache Tomcat server.xml config\n');
    
    reader.on('line', (line) => {
        const trimmedLine = line.trim();
        // We want to remove these lines from the config file        
        const isValid = ['scheme="https"', 'proxyPort="443"']
            .every(configLine => configLine !== trimmedLine);

        if (isValid) {
            fileContent += line + '\n';
        }
    });

    return new Promise((resolve, reject) => {
        reader.on('close', () => {
            writeFile(filePath, fileContent)
                .then(resolve)
                .catch(reject);
        });
    });
};

// Expose port 8080 on the webapp container, because that's the port the dev proxy uses
const modifyDockerConfig = () => {
    const filePath = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose/docker-compose.yml');

    logCommand('Modify Docker compose config\n');    

    return readFile(filePath)
        .then((fileContent) => {
            const config = yaml.safeLoad(fileContent, 'utf8');
            const ports = config.services.webapp.ports;

            if (!ports.includes('8080:8080')) {
                ports.push('8080:8080');
            }

            const serializedConfig = yaml.safeDump(config, {
                flowLevel: 0
            });

            return writeFile(filePath, serializedConfig);
        });
};

const getAllContainerHashes = () => {
    return execute('docker ps', {
            args: ['-a', '-q']
        })
        .then((hashBlock) => hashBlock.trim() && hashBlock.split('\n').join(' '));
};

const stopDockerContainers = (hashes) => {
    return execute('docker stop', {
        args: [hashes]
    });
};

const pruneDockerImages = () => {
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

const runDockerContainers = () => {
    return execute('docker-compose', {
        args: [
            '-f',
            'docker-compose.yml',
            'up',
            '-d'
        ], 
        cwd: composeDir
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
    });
};

const removeDockerContainers = () => {
    const args = [
        'down'
    ];

    if (doCleanVolumes) {
        args.push('-v');
    }

    return isDirectory(composeDir)
        .catch(() => {
            log('Rest-backend hasn\'t been previously built\n');
            return false;
        })    
        .then((isDir) => isDir && execute('docker-compose', {
            args,
            cwd: composeDir
        }))
        .then(() => doCleanImages ? removeHubImages() : Promise.resolve());
};

const pollContainerStatus = () => {
    const interval = 5000;
    const timeout = 180000;
    const start = new Date();

    logCommand('Polling for container health status\n');

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
                    logError('Containers timed out waiting for an all healthy status');
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
        removeDockerContainers()
    ])
    .then(() => buildRestBackend())
    // Modify the docker compose configuration and
    .then(() => modifyDockerConfig())
    // Run the new docker images
    .then(() => runDockerContainers())
    .then(() => pruneDockerImages())
    .then(() => pollContainerStatus())
    .catch(err => err && logError(err));

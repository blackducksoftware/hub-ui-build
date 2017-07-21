const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const yaml = require('js-yaml');
const chalk = require('chalk');
const humanize = require('humanize-duration');

const repoDir = path.resolve(__dirname, '../rest-backend');
const composeDir = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose');

const log = (msg) => {
    console.log(chalk.bgCyan.black(msg));
}

const logCommand = (msg) => {
    console.log(chalk.bgYellowBright.black.bold(msg));
};

const logData = (msg) => {
    console.log(chalk.green(msg));
};

const logError = (msg) => {
    console.log(chalk.red(msg));
};

// Spawn another process, run a command, and return the result
const execute = (command, opts = {}) => {
    const { 
        args = [], 
        cwd, 
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
        const trimmedData = data.trim();

        if (trimmedData && !silent) {
            logData(trimmedData);
        }

        listener(data);
        output += data;            
    });

    childProc.stderr.on('data', (buffer) => {
        const data = buffer.toString();
        const trimmedData = data.trim();
        if (trimmedData) {
            logError(trimmedData);
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
        .then((hashBlock) => {
            if (!hashBlock.trim()) {
                return;
            }
            return hashBlock.split('\n').join(' ');
        });
};

const stopDockerContainers = (hashes) => {
    return execute('docker stop', {
        args: [hashes]
    });
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
    })
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

const removeDockerContainers = () => {
    return getAllContainerHashes()
        .then((hashes) => {
            if (!hashes) {
                return;
            }

            return stopDockerContainers(hashes)
                .then(() => execute('docker rm', {
                    args: [hashes]
                }));
        });
};

const pollContainerStatus = () => {
    const interval = 10000;
    const timeout = 120000;
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
                    log(`Total setup time: ${humanize(new Date() - global.buildStart)}`);
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

global.buildStart = new Date();

modifyTomcatConfig()
    .then(() => buildRestBackend())
    // Modify the docker compose configuration and
    // stop / remove any docker images currently running
    .then(() => Promise.all([
        modifyDockerConfig(),
        removeDockerContainers()
    ]))
    // Run the new docker images
    .then(() => runDockerContainers())
    .then(() => pollContainerStatus())
    .catch(err => err && logError(err));

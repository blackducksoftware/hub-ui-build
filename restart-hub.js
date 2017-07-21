const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const yaml = require('js-yaml');

const repoDir = path.resolve(__dirname, '../rest-backend');
const composeDir = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose');

const executeCommand = (command, args = [], cwd) => {
    console.log('\nexecute', `${command} ${args.join(' ')}\n`);
    const process = spawn(command, args, { cwd, shell: true });
    let output = '';

    process.stdout.on('data', (buffer) => {
        const data = buffer.toString();
        const trimmedData = data.trim();
        if (trimmedData) {
            console.log(trimmedData);
        }
        output += data;            
    });

    process.stderr.on('data', (buffer) => {
        const data = buffer.toString();
        const trimmedData = data.trim();
        if (trimmedData) {
            console.log(trimmedData);
        }
    });

    return new Promise((resolve, reject) => {
        process.on('exit', (code) => {
            if (code === 0) {
                resolve(output);
            }
            reject('Error running:', `${command} ${args.join(' ')}`);
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

const modifyTomcatConfig = () => {
    console.log('Modify Tomcat config');
    const filePath = path.resolve(repoDir, 'docker/blackducksoftware/hub-tomcat/server.xml');
    const reader = readline.createInterface({
        input: fs.createReadStream(filePath)
    });
    let fileContent = '';    
    
    reader.on('line', (line) => {
        const isValid = ['scheme="https"', 'proxyPort="443"'].every(configLine => {
            // We want to remove these lines from the config file
            return !line.includes(configLine);
        });

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

const modifyDockerConfig = () => {
    console.log('Modify Docker config');
    const filePath = path.resolve(repoDir, 'docker/hub-docker/build/docker-compose/dev/docker-compose/docker-compose.yml');
    return readFile(filePath)
        .then((fileContent) => {
            const config = yaml.safeLoad(fileContent, 'utf8');

            if (!config.services.webapp.ports.includes('8080:8080')) {
                config.services.webapp.ports.push('8080:8080');
            }

            const serializedConfig = yaml.safeDump(config, {
                flowLevel: 0
            });
            return writeFile(filePath, serializedConfig);
        });
};

modifyTomcatConfig()
    .then(() => executeCommand('./gradlew', [
        'assemble',
        'docker',
        'docker:hub-docker:build'
    ], repoDir))
    .then(() => Promise.all([
        modifyDockerConfig(),
        executeCommand('docker ps', [
                '-a',
                '-q'
            ])
            .then((hashBlock) => {
                if (!hashBlock.trim()) {
                    return;
                }

                const hashes = hashBlock.split('\n').join(' ');

                return executeCommand('docker stop', [hashes])
                    .then(() => executeCommand('docker rm', [hashes]))
            })
    ]))
    .then(() => executeCommand('docker-compose', [
        '-f',
        'docker-compose.yml',
        'up',
        '-d'
    ], composeDir))
    .catch(err => console.warn(err));

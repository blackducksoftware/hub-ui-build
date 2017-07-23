const os = require('os');
const path = require('path');
const fsProm = require('./lib/fs-promise');
const execute = require('./lib/execute');

if (os.platform() === 'win32') {
    throw new Error('We don\'t support aliases for Windows');
}

const runHubPath = path.resolve(__dirname, 'hub-up.js');
const runDevPath = path.resolve(__dirname, 'hub-dev.js');
const bashrcPath = path.resolve(os.homedir(), '.bash_profile');
const uiDir = path.resolve(__dirname, '../ui');
const cmdsDir = path.resolve(__dirname, 'commands');
const startHub = `node ${runHubPath};`;

const aliases = [
    `alias hub-up='${startHub}'`,
    `alias hub-dev='node ${runDevPath}'`
];

fsProm.isFile(bashrcPath)
    .catch(err => false)
    .then(isFile => {
        if (isFile) {
            return fsProm.concatUniqueLines(bashrcPath, aliases);
        } else {
            return fsProm.writeFile(bashrcPath, `${aliases.join('\n')}\n`);
        }
    });

const buildUi = `cd ${uiDir};\ngrunt default watch;\n`;
const runLocalProxy = `cd ${uiDir};\nnode dev-server.js --local-port=8081 --remote-port=8080 --remote-host=localhost --no-mocks --no-ssl;\n`;
const buildUiCmdPath = path.resolve(cmdsDir, 'ui-build.command');
const buildHubCmdPath = path.resolve(cmdsDir, 'hub-start.command');
const proxyCmdPath = path.resolve(cmdsDir, 'ui-proxy.command');

fsProm.cleanDirectory(cmdsDir)
    .then(() => Promise.all([
        fsProm.writeFile(buildUiCmdPath, buildUi),
        fsProm.writeFile(buildHubCmdPath, startHub),
        fsProm.writeFile(proxyCmdPath, runLocalProxy)
    ]));

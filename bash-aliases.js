const os = require('os');
const path = require('path');
const fsProm = require('./lib/fs-promise');
const execute = require('./lib/execute');
const log = require('./lib/log');

if (os.platform() === 'win32') {
    throw new Error('We don\'t support aliases for Windows');
}

const runHubPath = path.resolve(__dirname, 'hub-up.js');
const runDevPath = path.resolve(__dirname, 'ui-dev.js');
const runUiPath = path.resolve(__dirname, 'ui-up.js');
const bashrcPath = path.resolve(os.homedir(), '.bashrc');
const bashProfilePath = path.resolve(os.homedir(), '.bash_profile');
const uiDir = path.resolve(__dirname, '../ui');
const cmdsDir = path.resolve(__dirname, 'commands');
const startHub = `node ${runHubPath}`;

const aliases = [
    `function hub-up() { ${startHub} $@; }`,
    `function ui-up() { node ${runUiPath} $@; }`,
    `function ui-dev() { node ${runDevPath} $@; }`
];

fsProm.isFile(bashrcPath)
    .catch(err => false)
    .then(isFile => {

        log.command(`Writing aliases: \n \t${aliases.join('\n\t')}\n to ${bashrcPath}\n`);

        if (isFile) {
            return fsProm.concatUniqueLines(bashrcPath, aliases);
        } else {
            return fsProm.writeFile(bashrcPath, `${aliases.join('\n')}\n`);
        }
    });

const source = `source ${bashrcPath}`;

fsProm.isFile(bashProfilePath)
    .catch(err => false)
    .then(isFile => {

        log.command(`Sourcing ${bashrcPath} from ${bashProfilePath}\n`);

        if (isFile) {
            return fsProm.concatUniqueLines(bashProfilePath, [source]);
        } else {
            return fsProm.writeFile(bashProfilePath, `${source}\n`);
        }
    });

const buildUi = `printf '\\e[4;290;540t'; printf '\\e[3;540;0t'; printf '\\e[3;0;206t'; cd ${uiDir};\ngrunt default watch;\n`;
const runLocalProxy = `printf '\\e[4;206;540t'; printf '\\e[3;0;0t'; cd ${uiDir};\nnode dev-server.js --local-port=8081 --remote-port=8080 --remote-host=localhost --no-mocks --no-ssl;\n`;
const buildUiCmdPath = path.resolve(cmdsDir, 'ui-build.command');
const buildHubCmdPath = path.resolve(cmdsDir, 'hub-start.command');
const proxyCmdPath = path.resolve(cmdsDir, 'ui-proxy.command');

fsProm.cleanDirectory(cmdsDir)
    .then(() => Promise.all([
        fsProm.writeFile(buildUiCmdPath, buildUi),
        fsProm.writeFile(buildHubCmdPath, `printf '\\e[4;426;540t'; printf '\\e[3;0;505t'; printf '\\e[5t'; ${startHub}`),
        fsProm.writeFile(proxyCmdPath, runLocalProxy)
    ]))
    .then(() => Promise.all([
        execute.setPermission(buildUiCmdPath),
        execute.setPermission(buildHubCmdPath),
        execute.setPermission(proxyCmdPath)
    ]));

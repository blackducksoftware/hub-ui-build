const os = require('os');
const path = require('path');
const fsProm = require('./lib/fs-promise');
const execute = require('./lib/execute');
const log = require('./lib/log');
const runHubPath = path.resolve(__dirname, 'hub-up.js');
const runDevPath = path.resolve(__dirname, 'ui-dev.js');
const runUiPath = path.resolve(__dirname, 'ui-up.js');
const hubupPath = path.resolve(os.homedir(), '.hub-up');
const bashProfilePath = path.resolve(os.homedir(), '.profile');
const uiDir = process.env.UI_REPO_DIR;
const cmdsDir = path.join(__dirname, 'commands');

const aliases = [
    `function hub-up() { node ${runHubPath} $@; }`,
    `function ui-up() { node ${runUiPath} $@; }`,
    `function ui-dev() { node ${runDevPath} $@; }`
];

log(`Binding aliases: ${log.getCommandColor('hub-up')}, ${log.getCommandColor('ui-up')} and ${log.getCommandColor('ui-dev')}`);
fsProm.writeFile(hubupPath, `${aliases.join('\n')}\n`);

const source = `source ${hubupPath}`;

fsProm.isFile(bashProfilePath)
    .then(isFile => {
        if (isFile) {
            return fsProm.concatUniqueLines(bashProfilePath, [source]);
        } else {
            return fsProm.writeFile(bashProfilePath, `${source}\n`);
        }
    });

const buildUi = `printf '\\e[4;290;540t'; printf '\\e[3;540;0t'; printf '\\e[3;0;206t'; cd ${uiDir};\nnpm run dev -- --force;\n`;
const runLocalProxy = `printf '\\e[4;206;540t'; printf '\\e[3;0;0t'; cd ${uiDir};\nnpm run proxy:local;\n`;
const startHub = `printf '\\e[4;426;540t'; printf '\\e[3;0;505t'; printf '\\e[5t'; node ${runHubPath};\n`;
const buildUiCmdPath = path.join(cmdsDir, 'ui-build.sh');
const buildHubCmdPath = path.join(cmdsDir, 'hub-start.sh');
const proxyCmdPath = path.join(cmdsDir, 'ui-proxy.sh');


Promise.all([
    fsProm.outputFile(buildUiCmdPath, buildUi),
    fsProm.outputFile(buildHubCmdPath, startHub),
    fsProm.outputFile(proxyCmdPath, runLocalProxy)
])
    .then(() => Promise.all([
        execute.setPermission(buildUiCmdPath),
        execute.setPermission(buildHubCmdPath),
        execute.setPermission(proxyCmdPath)
    ]))
    .then(() => {
        log(`To use the aliases in this terminal, run this command: ${log.getCommandColor(source)}`);
        log('You can use hub-up --help to get a list of command arguments');
    });

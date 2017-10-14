const os = require('os');
const path = require('path');
const fs = require('./lib/fs-promise');
const execute = require('./lib/execute');
const log = require('./lib/log');
const cmdsDir = path.join(__dirname, 'commands');
const PATH = {
    hubUp: path.resolve(__dirname, 'hub-up.js'),
    uiDev: path.resolve(__dirname, 'ui-dev.js'),
    uiUp: path.resolve(__dirname, 'ui-up.js'),
    aliases: path.resolve(os.homedir(), '.hub-up'),
    terminalRc: process.env.TERMINAL_RC_PATH,
    ui: process.env.UI_REPO_DIR,
    buildUiCmd: path.join(cmdsDir, 'ui-build.sh'),
    buildHubCmd: path.join(cmdsDir, 'hub-start.sh'),
    proxyCmd: path.join(cmdsDir, 'ui-proxy.sh')
};

const aliases = [
    `function hub-up() { node ${PATH.hubUp} $@; }`,
    `function ui-up() { node ${PATH.uiUp} $@; }`,
    `function ui-dev() { node ${PATH.uiDev} $@; }`
];

log(`Binding aliases: ${log.getCommandColor('hub-up')}, ${log.getCommandColor('ui-up')} and ${log.getCommandColor('ui-dev')}`);
fs.writeFile(PATH.aliases, `${aliases.join('\n')}\n`);

const source = `source ${PATH.aliases}`;

fs.isFile(PATH.terminalRc)
    .then(isFile => {
        if (isFile) {
            return fs.concatUniqueLines(PATH.terminalRc, [source]);
        } else {
            return fs.writeFile(PATH.terminalRc, `${source}\n`);
        }
    });

const buildUi = `printf '\\e[4;290;540t'; printf '\\e[3;540;0t'; printf '\\e[3;0;206t'; cd ${PATH.ui};\nnpm run dev -- --force;\n`;
const runLocalProxy = `printf '\\e[4;206;540t'; printf '\\e[3;0;0t'; cd ${PATH.ui};\nnpm run proxy:local;\n`;
const startHub = `printf '\\e[4;426;700t'; printf '\\e[3;0;505t'; printf '\\e[5t'; node ${PATH.hubUp};\n`;

Promise.all([
    fs.outputFile(PATH.buildUiCmd, buildUi),
    fs.outputFile(PATH.buildHubCmd, startHub),
    fs.outputFile(PATH.proxyCmd, runLocalProxy)
])
    .then(() => Promise.all([
        execute.setPermission(PATH.buildUiCmd),
        execute.setPermission(PATH.buildHubCmd),
        execute.setPermission(PATH.proxyCmd)
    ]))
    .then(() => {
        log(`To use the aliases in this terminal, run this command: ${log.getCommandColor(source)}`);
        log(`You can use ${log.getCommandColor('hub-up --help')} to get a list of command arguments`);
    });

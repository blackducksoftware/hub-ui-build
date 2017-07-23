const path = require('path');
const execute = require('./lib/execute');
const escapeString = require('escape-string-applescript');

const hubBuildPath = path.resolve(__dirname, 'commands/hub-start.command');
const uiBuildPath = path.resolve(__dirname, 'commands/ui-build.command');
const proxyPath = path.resolve(__dirname, 'commands/ui-proxy.command');

Promise.all([
    execute(`osascript -e 'tell application "Terminal" to do script "${escapeString(hubBuildPath)}"'`),
    execute(`osascript -e 'tell application "Terminal" to do script "${escapeString(uiBuildPath)}"'`),
    execute(`osascript -e 'tell application "Terminal" to do script "${escapeString(proxyPath)}"'`)
]);

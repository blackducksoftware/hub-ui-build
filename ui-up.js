const path = require('path');
const execute = require('./lib/execute');

const uiBuildPath = path.join(__dirname, 'commands/ui-build.sh');
const proxyPath = path.join(__dirname, 'commands/ui-proxy.sh');

execute.newTerminal(uiBuildPath);
execute.newTerminal(proxyPath);

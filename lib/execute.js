const log = require('./log');
const escapeString = require('escape-string-applescript');
const { spawn } = require('child_process');

// Spawn another process, run a command, and return the result
const execute = (command, opts = {}) => {
    const {
        cwd,        
        args = [], 
        listener = () => {},
        silent = false
    } = opts;
    const childProc = spawn(command, args, { cwd, shell: true });
    let output = '';
    let errorOutput = '';

    if (!silent) {
        log.command(`${command} ${args.join(' ')}\n`);
    }

    childProc.stdout.on('data', (buffer) => {
        const data = buffer.toString();

        if (data && !silent) {
            log.data(data);
        }

        listener(data);
        output += data;            
    });

    childProc.stderr.on('data', (buffer) => {
        const data = buffer.toString();

        if (data && !silent) {
            log.data(data);
        }

        errorOutput += data;
    });

    return new Promise((resolve, reject) => {
        childProc.on('exit', (code) => {
            if ((output.trim() || errorOutput.trim()) && !silent) {
                log.data('\n');
            }

            if (code === 0) {
                resolve(output);
            }

            reject(`Error running: ${command} ${args.join(' ')}`);
        });
    });
};

const setPermission = (filePath) => {
    return execute('chmod', {
        args: [
            'u+x',
            filePath
        ]
    });
};

// Script may also be a path to bash script
const newTerminal = (script) => {
    return execute(`osascript -e 'tell application "Terminal" to do script "${escapeString(script)}"'`)
};

module.exports = execute;
module.exports.newTerminal = newTerminal;
module.exports.setPermission = setPermission;

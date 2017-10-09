const chalk = require('chalk');

const getCommandColor = (msg) => {
    return chalk.bgBlack.white(msg);
};

const log = (msg) => {
    console.log(`${chalk.bgCyan.black.bold('log')}: ${chalk.bgBlack.cyan(msg)}`);
};

const command = (msg) => {
    console.log(getCommandColor(`${chalk.bgWhite.black.bold('command')}: ${msg}`));
};

const data = (msg) => {
    process.stdout.write(msg);
};

const error = (msg) => {
    console.log(chalk.red(msg));
};

// Repaint takes in a stream that emits strings to write
const repaint = (msgStream) => {
    const charm = require('charm')(process.stdin, process.stdout);
    let isFirstPaint = true;

    msgStream.on('data', (msg) => {
        const lineCount = Array.isArray(msg) ? msg.length : msg.split('\n').length;

        if (isFirstPaint) {
            isFirstPaint = false;
        } else {
            charm.move(0, -lineCount);
            charm.erase('down');
        }

        if (Array.isArray(msg)) {
            msg.forEach(line => {
                charm.write(line);
            });
        } else {
            charm.write(msg);
        }
    });

    msgStream.on('end', () => {
        charm.destroy();
    });

    msgStream.on('error', () => {
        charm.destroy();
    });
};


Object.assign(log, {
    command,
    data,
    error,
    getCommandColor,
    repaint
});

module.exports = log;

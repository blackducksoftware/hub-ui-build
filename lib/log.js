'use strict';

const chalk = require('chalk');
const stringWidth = require('string-width');

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
    let lastMsg = 0;

    msgStream.on('data', (rawMsg) => {
        const msg = Array.isArray(rawMsg) ? rawMsg.join('') : rawMsg;
        const lastWriteLength = lastMsg && lastMsg.split('\n').reduce((totalLines, line) => {
            return totalLines + Math.ceil(stringWidth(line) / process.stdout.columns) || 1;
        }, 0);
        charm.move(0, -lastWriteLength);
        charm.erase('down');
        charm.write(msg);
        lastMsg = msg;
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

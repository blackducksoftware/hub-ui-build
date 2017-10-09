const through = require('through2');
const log = require('./log');
const execute = require('./execute');
const chalk = require('chalk');
const { parseStatus, get: getContainers } = require('./containers');

const getTable = () => {
    return execute('docker ps', {
        silent: true,
        args: [
            '--format="table {{.Names}}\t{{.Status}}"'
        ]
    });
};

const highlightTable = (table, containerMap) => {
    return table.split('\n')
        .map((line, index) => {
            if (!line || index === 0) {
                return '    ' + line + '\n';
            }

            const name = line.split(' ')[0];
            const { status } = containerMap[name][0];

            let lineColor;
            let icon;
            switch (status) {
                case 'starting':
                    icon = ' ❏ ';
                    lineColor = chalk.bgBlack.yellowBright;
                    break;

                case 'restarting':
                    icon = ' ✗ ';
                    lineColor = chalk.bgBlack.red;
                    break;

                case 'healthy':
                    lineColor = chalk.bgBlack.greenBright;
                    icon = ' ✓ ';
                    break;

                case 'unhealthy':
                    icon = ' ✗ ';
                    lineColor = chalk.bgBlack.redBright;
                    break;
            }

            return lineColor(`${icon} ${line}\n`);
        });
};

class ContainerTable {
    constructor() {
        this.stream = through.obj(function (msg, enc, callback) {
            this.push(msg);
            callback();
        });
    }

    start() {
        log.repaint(this.stream);
    }

    render() {
        this.isRendering = true;

        return Promise.all([
            getContainers({ byGrouping: 'name' }),
            getTable()
        ]).then(([containerMap, table]) => {
            this.stream.write(highlightTable(table, containerMap));

            if (this.doStop) {
                this.stream.end();
            }

            this.isRendering = false;
        });
    }

   stop() {
        if (this.isRendering) {
            this.doStop = true;
            return;
        }

        this.stream.end();
    }
}

module.exports = ContainerTable;

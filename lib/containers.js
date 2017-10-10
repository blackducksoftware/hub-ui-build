const log = require('./log');
const execute = require('./execute');
const fs = require('./fs-promise');

class Containers {
    constructor(opts) {
        Object.assign(this, opts);
        this.mountAttempts = 0;
    }

    mount() {
        return execute('docker-compose', {
            args: [
                'up',
                '-d'
            ],
            cwd: this.composeDir
        })
            .catch(() => {
                this.mountAttempts++;
                log.error('Docker containers failed to mount.\n');
    
                if (this.mountAttempts < 2) {
                    log('Removing all old containers and re-creating from new images.\n');
                    
                    return this.remove()
                        .then(() => this.mount());
                }
            });
    }

    remove(doPruneVolumes) {
        const args = ['down'];

        if (doPruneVolumes) {
            args.push('-v');
        }

        return fs.isDirectory(this.composeDir)
            .catch(() => {
                log('Rest-backend hasn\'t been previously built\n');
                return false;
            })
            .then((isDir) => isDir && execute('docker-compose', {
                args,
                cwd: this.composeDir
            }));
    }
}

Containers.get = ({ byGrouping } = {}) => {
    return execute(`docker ps`, {
        silent: true,
        args: [
            '--format="{{.ID}}\t{{.Names}}\t{{.Status}}"'
        ]
    })
        .then((containersData) => {
            return containersData
                .trim()
                .split('\n')
                .map(containerData => {
                    const [id, name, statusStr] = containerData.split('\t');
                    return {
                        id,
                        name,
                        status: Containers.parseStatus(statusStr)
                    };
                });
        })
        .then(containers => {
            if (!byGrouping) {
                return containers;
            }

            return containers.reduce((obj, container) => {
                const grouping = container[byGrouping];

                if (obj[grouping]) {
                    obj[grouping].push(container);
                } else {
                    obj[grouping] = [container];
                }

                return obj;
            }, {});
        });
};

Containers.parseStatus = (statusStr) => {
    const statusMap = {
        unhealthy: '(unhealthy)',
        healthy: '(healthy)',
        restarting: 'Restarting (',
        starting: '(health: starting)'
    };

    return Object.keys(statusMap)
        .find(status => statusStr.includes(statusMap[status]));
};

Containers.groupByProperty = (containers, key) => {
    return containers.reduce((obj, container) => {
        const value = container[key];

        if (obj[value]) {
            obj[value].push(container);
        } else {
            obj[value] = [container];
        }

        return obj;
    }, {});
};

module.exports = Containers;

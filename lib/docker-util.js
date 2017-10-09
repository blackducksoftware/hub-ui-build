const execute = require('./execute');

const pruneImages = () => {
    return execute('docker image prune', {
        args: ['-f']
    });
};

const pruneVolumes = () => {
    return execute('docker volume prune', {
        args: ['-f']
    });
};

module.exports = {
    pruneImages,
    pruneVolumes
};

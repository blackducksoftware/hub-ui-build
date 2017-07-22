const fs = require('fs');
const readline = require('readline');

module.exports.isDirectory = (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.stat(dirPath, (err, stats) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stats.isDirectory());
        });
    });
};

module.exports.writeFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        });
    });
};

module.exports.readFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });
};

module.exports.filterLines = (filePath, evalFn) => {
    const reader = readline.createInterface({
        input: fs.createReadStream(filePath)
    });
    let fileContent = '';

    reader.on('line', (line) => {
        if (evalFn(line)) {
            fileContent += line + '\n';
        }
    });

    return new Promise((resolve, reject) => {
        reader.on('close', () => {
            resolve(fileContent);
        });
    });
};

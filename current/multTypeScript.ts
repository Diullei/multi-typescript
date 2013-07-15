///<reference path='io.ts'/>
///<reference path='optionsParser.ts'/>

declare var require;
declare var __dirname;
declare var process;

var fs = require('fs');
var path = require('path');
var util = require('util');

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

function mkdir(dir) {
    // making directory without exception if exists
    try {
        fs.mkdirSync(dir, 0755);
    } catch (e) {
        if (e.code != "EEXIST") {
            throw e;
        }
    }
};

function rmdir(dir) {
    if (path.existsSync(dir)) {
        var list = fs.readdirSync(dir);
        for (var i = 0; i < list.length; i++) {
            var filename = path.join(dir, list[i]);
            var stat = fs.statSync(filename);

            if (filename == "." || filename == "..") {
                // pass these files
            } else if (stat.isDirectory()) {
                // rmdir recursively
                rmdir(filename);
            } else {
                // rm fiilename
                fs.unlinkSync(filename);
            }
        }
        fs.rmdirSync(dir);
    } else {
        console.warn("warn: " + dir + " not exists");
    }
};

function copyDir(src, dest) {
    mkdir(dest);
    var files = fs.readdirSync(src);
    for (var i = 0; i < files.length; i++) {
        var current = fs.lstatSync(path.join(src, files[i]));
        if (current.isDirectory()) {
            copyDir(path.join(src, files[i]), path.join(dest, files[i]));
        } else if (current.isSymbolicLink()) {
            var symlink = fs.readlinkSync(path.join(src, files[i]));
            fs.symlinkSync(symlink, path.join(dest, files[i]));
        } else {
            copy(path.join(src, files[i]), path.join(dest, files[i]));
        }
    }
};

function copy(src, dest) {
    var oldFile = fs.createReadStream(src);
    var newFile = fs.createWriteStream(dest);
    oldFile.pipe(newFile);
};

function update() {
    var sys = require('sys');
    var exec = require('child_process').exec;
    var child;
    var http = require('http');
    var newest;
    var current;
    var options = {
        host: 'registry.npmjs.org',
        port: 80,
        path: '/multi-typescript'
    };

    var packageConfig = require('../package');
    var version = packageConfig.version;

    http.get(options, function (res) {
        var jsond = '';
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            jsond = JSON.parse(body);
            if (jsond['dist-tags'].latest > version) {
                // executes `pwd`
                child = exec("npm install multi-typescript@" + jsond['dist-tags'].latest, function (error, stdout, stderr) {
                    if (error !== null) {
                        console.log('exec error: ' + error);
                    }
                    console.log("Upgrade Complete:  You are now on 'multi-typescript' version: " + jsond['dist-tags'].latest);
                });
            } else {
                console.log("Already Up To Date");
            }
        });
    }).on('error', function (e) {
            console.error(e);
        });
}

var file = __dirname + '/config.json';

var config = JSON.parse(fs.readFileSync(file));

if (process.argv[2] == 'set') {
    if (config["versions"][process.argv[3]]) {
        // delete current
        deleteFolderRecursive(__dirname + '/../current');
        // copy base
        copyDir(__dirname + '/../base', __dirname + '/../current');
        // copy ts version
        copyDir(__dirname + '/' + config["versions"][process.argv[3]], __dirname + '/../current');

        IO.stdout.WriteLine('');
        IO.stdout.WriteLine(' Switched to version \'' + process.argv[3] + '\'');
        IO.stdout.WriteLine('');
    } else {
        IO.stdout.WriteLine('Invalid TypeScript version \'' + process.argv[3] + '\'.');
    }
} else if (process.argv[2] == 'versions') {
    IO.stdout.WriteLine('\33[33m\33[1m! develop - (unstable version)\33[0m');
    IO.stdout.WriteLine('\33[36m\33[1m* 0.9.0.1 - (last released)\33[0m');
    IO.stdout.WriteLine('  0.9.0.0');
    IO.stdout.WriteLine('  0.9.0-alpha');
    IO.stdout.WriteLine('  0.8.3.0');
    IO.stdout.WriteLine('  0.8.2.0');
    IO.stdout.WriteLine('');
    IO.stdout.WriteLine(' User "mtsc --version" to print the current compiler\'s version.');
    IO.stdout.WriteLine('');
} else if (process.argv[2] == 'update') {
    update();
} else {
    require('./tsc.js')
}
var ByteOrderMark;
(function (ByteOrderMark) {
    ByteOrderMark[ByteOrderMark["None"] = 0] = "None";
    ByteOrderMark[ByteOrderMark["Utf8"] = 1] = "Utf8";
    ByteOrderMark[ByteOrderMark["Utf16BigEndian"] = 2] = "Utf16BigEndian";
    ByteOrderMark[ByteOrderMark["Utf16LittleEndian"] = 3] = "Utf16LittleEndian";
})(ByteOrderMark || (ByteOrderMark = {}));

var FileInformation = (function () {
    function FileInformation(contents, byteOrderMark) {
        this._contents = contents;
        this._byteOrderMark = byteOrderMark;
    }
    FileInformation.prototype.contents = function () {
        return this._contents;
    };

    FileInformation.prototype.byteOrderMark = function () {
        return this._byteOrderMark;
    };
    return FileInformation;
})();

var Environment = (function () {
    function getNodeEnvironment() {
        var _fs = require('fs');
        var _path = require('path');
        var _module = require('module');

        return {
            currentDirectory: function () {
                return (process).cwd();
            },
            readFile: function (file) {
                var buffer = _fs.readFileSync(file);
                switch (buffer[0]) {
                    case 0xFE:
                        if (buffer[1] === 0xFF) {
                            var i = 0;
                            while ((i + 1) < buffer.length) {
                                var temp = buffer[i];
                                buffer[i] = buffer[i + 1];
                                buffer[i + 1] = temp;
                                i += 2;
                            }
                            return new FileInformation(buffer.toString("ucs2", 2), ByteOrderMark.Utf16BigEndian);
                        }
                        break;
                    case 0xFF:
                        if (buffer[1] === 0xFE) {
                            return new FileInformation(buffer.toString("ucs2", 2), ByteOrderMark.Utf16LittleEndian);
                        }
                        break;
                    case 0xEF:
                        if (buffer[1] === 0xBB) {
                            return new FileInformation(buffer.toString("utf8", 3), ByteOrderMark.Utf8);
                        }
                }

                return new FileInformation(buffer.toString("utf8", 0), ByteOrderMark.None);
            },
            writeFile: function (path, contents, writeByteOrderMark) {
                function mkdirRecursiveSync(path) {
                    var stats = _fs.statSync(path);
                    if (stats.isFile()) {
                        throw "\"" + path + "\" exists but isn't a directory.";
                    } else if (stats.isDirectory()) {
                        return;
                    } else {
                        mkdirRecursiveSync(_path.dirname(path));
                        _fs.mkdirSync(path, 0775);
                    }
                }
                mkdirRecursiveSync(_path.dirname(path));

                if (writeByteOrderMark) {
                    contents = '\uFEFF' + contents;
                }
                _fs.writeFileSync(path, contents, "utf8");
            },
            fileExists: function (path) {
                return _fs.existsSync(path);
            },
            deleteFile: function (path) {
                try  {
                    _fs.unlinkSync(path);
                } catch (e) {
                }
            },
            directoryExists: function (path) {
                return _fs.existsSync(path) && _fs.statSync(path).isDirectory();
            },
            listFiles: function dir(path, spec, options) {
                options = options || {};

                function filesInFolder(folder) {
                    var paths = [];

                    var files = _fs.readdirSync(folder);
                    for (var i = 0; i < files.length; i++) {
                        var stat = _fs.statSync(folder + "\\" + files[i]);
                        if (options.recursive && stat.isDirectory()) {
                            paths = paths.concat(filesInFolder(folder + "\\" + files[i]));
                        } else if (stat.isFile() && (!spec || files[i].match(spec))) {
                            paths.push(folder + "\\" + files[i]);
                        }
                    }

                    return paths;
                }

                return filesInFolder(path);
            },
            arguments: process.argv.slice(2),
            standardOut: {
                Write: function (str) {
                    process.stdout.write(str);
                },
                WriteLine: function (str) {
                    process.stdout.write(str + '\n');
                },
                Close: function () {
                }
            }
        };
    }
    ;

    return getNodeEnvironment();
})();

var IOUtils;
(function (IOUtils) {
    function createDirectoryStructure(ioHost, dirName) {
        if (ioHost.directoryExists(dirName)) {
            return;
        }

        var parentDirectory = ioHost.dirName(dirName);
        if (parentDirectory != "") {
            createDirectoryStructure(ioHost, parentDirectory);
        }
        ioHost.createDirectory(dirName);
    }

    function writeFileAndFolderStructure(ioHost, fileName, contents, writeByteOrderMark) {
        var path = ioHost.resolvePath(fileName);
        var dirName = ioHost.dirName(path);
        createDirectoryStructure(ioHost, dirName);
        return ioHost.writeFile(path, contents, writeByteOrderMark);
    }
    IOUtils.writeFileAndFolderStructure = writeFileAndFolderStructure;

    function throwIOError(message, error) {
        var errorMessage = message;
        if (error && error.message) {
            errorMessage += (" " + error.message);
        }
        throw new Error(errorMessage);
    }
    IOUtils.throwIOError = throwIOError;

    var BufferedTextWriter = (function () {
        function BufferedTextWriter(writer, capacity) {
            if (typeof capacity === "undefined") { capacity = 1024; }
            this.writer = writer;
            this.capacity = capacity;
            this.buffer = "";
        }
        BufferedTextWriter.prototype.Write = function (str) {
            this.buffer += str;
            if (this.buffer.length >= this.capacity) {
                this.writer.Write(this.buffer);
                this.buffer = "";
            }
        };
        BufferedTextWriter.prototype.WriteLine = function (str) {
            this.Write(str + '\r\n');
        };
        BufferedTextWriter.prototype.Close = function () {
            this.writer.Write(this.buffer);
            this.writer.Close();
            this.buffer = null;
        };
        return BufferedTextWriter;
    })();
    IOUtils.BufferedTextWriter = BufferedTextWriter;
})(IOUtils || (IOUtils = {}));

var IO = (function () {
    function getNodeIO() {
        var _fs = require('fs');
        var _path = require('path');
        var _module = require('module');

        return {
            readFile: function (file) {
                return Environment.readFile(file);
            },
            writeFile: function (path, contents, writeByteOrderMark) {
                Environment.writeFile(path, contents, writeByteOrderMark);
            },
            deleteFile: function (path) {
                try  {
                    _fs.unlinkSync(path);
                } catch (e) {
                    IOUtils.throwIOError("Couldn't delete file '" + path + "'.", e);
                }
            },
            fileExists: function (path) {
                return _fs.existsSync(path);
            },
            dir: function dir(path, spec, options) {
                options = options || {};

                function filesInFolder(folder) {
                    var paths = [];

                    try  {
                        var files = _fs.readdirSync(folder);
                        for (var i = 0; i < files.length; i++) {
                            var stat = _fs.statSync(folder + "/" + files[i]);
                            if (options.recursive && stat.isDirectory()) {
                                paths = paths.concat(filesInFolder(folder + "/" + files[i]));
                            } else if (stat.isFile() && (!spec || files[i].match(spec))) {
                                paths.push(folder + "/" + files[i]);
                            }
                        }
                    } catch (err) {
                    }

                    return paths;
                }

                return filesInFolder(path);
            },
            createDirectory: function (path) {
                try  {
                    if (!this.directoryExists(path)) {
                        _fs.mkdirSync(path);
                    }
                } catch (e) {
                    IOUtils.throwIOError("Couldn't create directory '" + path + "'.", e);
                }
            },
            directoryExists: function (path) {
                return _fs.existsSync(path) && _fs.statSync(path).isDirectory();
            },
            resolvePath: function (path) {
                return _path.resolve(path);
            },
            dirName: function (path) {
                return _path.dirname(path);
            },
            findFile: function (rootPath, partialFilePath) {
                var path = rootPath + "/" + partialFilePath;

                while (true) {
                    if (_fs.existsSync(path)) {
                        return { fileInformation: this.readFile(path), path: path };
                    } else {
                        var parentPath = _path.resolve(rootPath, "..");

                        if (rootPath === parentPath) {
                            return null;
                        } else {
                            rootPath = parentPath;
                            path = _path.resolve(rootPath, partialFilePath);
                        }
                    }
                }
            },
            print: function (str) {
                process.stdout.write(str);
            },
            printLine: function (str) {
                process.stdout.write(str + '\n');
            },
            arguments: process.argv.slice(2),
            stderr: {
                Write: function (str) {
                    process.stderr.write(str);
                },
                WriteLine: function (str) {
                    process.stderr.write(str + '\n');
                },
                Close: function () {
                }
            },
            stdout: {
                Write: function (str) {
                    process.stdout.write(str);
                },
                WriteLine: function (str) {
                    process.stdout.write(str + '\n');
                },
                Close: function () {
                }
            },
            watchFile: function (fileName, callback) {
                var firstRun = true;
                var processingChange = false;

                var fileChanged = function (curr, prev) {
                    if (!firstRun) {
                        if (curr.mtime < prev.mtime) {
                            return;
                        }

                        _fs.unwatchFile(fileName, fileChanged);
                        if (!processingChange) {
                            processingChange = true;
                            callback(fileName);
                            setTimeout(function () {
                                processingChange = false;
                            }, 100);
                        }
                    }
                    firstRun = false;
                    _fs.watchFile(fileName, { persistent: true, interval: 500 }, fileChanged);
                };

                fileChanged();
                return {
                    fileName: fileName,
                    close: function () {
                        _fs.unwatchFile(fileName, fileChanged);
                    }
                };
            },
            run: function (source, fileName) {
                require.main.fileName = fileName;
                require.main.paths = _module._nodeModulePaths(_path.dirname(_fs.realpathSync(fileName)));
                require.main._compile(source, fileName);
            },
            getExecutingFilePath: function () {
                return (process).mainModule.filename;
            },
            quit: process.exit
        };
    }
    ;

    return getNodeIO();
})();
var OptionsParser = (function () {
    function OptionsParser(host) {
        this.host = host;
        this.DEFAULT_SHORT_FLAG = "-";
        this.DEFAULT_LONG_FLAG = "--";
        this.unnamed = [];
        this.options = [];
    }
    OptionsParser.prototype.findOption = function (arg) {
        for (var i = 0; i < this.options.length; i++) {
            if (arg === this.options[i].short || arg === this.options[i].name) {
                return this.options[i];
            }
        }

        return null;
    };

    OptionsParser.prototype.printUsage = function () {
        this.host.printLine("Syntax:   tsmvc [options]");
        this.host.printLine("");
        this.host.printLine("Options:");

        var output = [];
        var maxLength = 0;
        var i = 0;

        this.options = this.options.sort(function (a, b) {
            var aName = a.name.toLowerCase();
            var bName = b.name.toLowerCase();

            if (aName > bName) {
                return 1;
            } else if (aName < bName) {
                return -1;
            } else {
                return 0;
            }
        });

        for (i = 0; i < this.options.length; i++) {
            var option = this.options[i];

            if (option.experimental) {
                continue;
            }

            if (!option.usage) {
                break;
            }

            var usageString = "  ";
            var type = option.type ? " " + option.type.toUpperCase() : "";

            if (option.short) {
                usageString += this.DEFAULT_SHORT_FLAG + option.short + type + ", ";
            }

            usageString += this.DEFAULT_LONG_FLAG + option.name + type;

            output.push([usageString, option.usage]);

            if (usageString.length > maxLength) {
                maxLength = usageString.length;
            }
        }

        for (i = 0; i < output.length; i++) {
            this.host.printLine(output[i][0] + (new Array(maxLength - output[i][0].length + 3)).join(" ") + output[i][1]);
        }
    };

    OptionsParser.prototype.option = function (name, config, short) {
        if (!config) {
            config = short;
            short = null;
        }

        config.name = name;
        config.short = short;
        config.flag = false;

        this.options.push(config);
    };

    OptionsParser.prototype.flag = function (name, config, short) {
        if (!config) {
            config = short;
            short = null;
        }

        config.name = name;
        config.short = short;
        config.flag = true;

        this.options.push(config);
    };

    OptionsParser.prototype.parseString = function (argString) {
        var position = 0;
        var tokens = argString.match(/\s+|"|[^\s"]+/g);

        function peek() {
            return tokens[position];
        }

        function consume() {
            return tokens[position++];
        }

        function consumeQuotedString() {
            var value = '';
            consume();

            var token = peek();

            while (token && token !== '"') {
                consume();

                value += token;

                token = peek();
            }

            consume();

            return value;
        }

        var args = [];
        var currentArg = '';

        while (position < tokens.length) {
            var token = peek();

            if (token === '"') {
                currentArg += consumeQuotedString();
            } else if (token.match(/\s/)) {
                if (currentArg.length > 0) {
                    args.push(currentArg);
                    currentArg = '';
                }

                consume();
            } else {
                consume();
                currentArg += token;
            }
        }

        if (currentArg.length > 0) {
            args.push(currentArg);
        }

        this.parse(args);
    };

    OptionsParser.prototype.parse = function (args) {
        var position = 0;

        function consume() {
            return args[position++];
        }

        while (position < args.length) {
            var current = consume();
            var match = current.match(/^(--?|@)(.*)/);
            var value = null;

            if (match) {
                if (match[1] === '@') {
                    this.parseString(this.host.readFile(match[2]).contents());
                } else {
                    var arg = match[2];
                    var option = this.findOption(arg);

                    if (option === null) {
                        this.host.printLine("Unknown option '" + arg + "'");
                        this.host.printLine("Use the '--help' flag to see options");
                    } else {
                        if (!option.flag)
                            value = consume();

                        option.set(value);
                    }
                }
            } else {
                this.unnamed.push(current);
            }
        }
    };
    return OptionsParser;
})();
var fs = require('fs');
var path = require('path');
var util = require('util');

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}
;

function mkdir(dir) {
    try  {
        fs.mkdirSync(dir, 0755);
    } catch (e) {
        if (e.code != "EEXIST") {
            throw e;
        }
    }
}
;

function rmdir(dir) {
    if (path.existsSync(dir)) {
        var list = fs.readdirSync(dir);
        for (var i = 0; i < list.length; i++) {
            var filename = path.join(dir, list[i]);
            var stat = fs.statSync(filename);

            if (filename == "." || filename == "..") {
            } else if (stat.isDirectory()) {
                rmdir(filename);
            } else {
                fs.unlinkSync(filename);
            }
        }
        fs.rmdirSync(dir);
    } else {
        console.warn("warn: " + dir + " not exists");
    }
}
;

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
}
;

function copy(src, dest) {
    var oldFile = fs.createReadStream(src);
    var newFile = fs.createWriteStream(dest);
    oldFile.pipe(newFile);
}
;

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
                child = exec("npm install multi-typescript@" + jsond['dist-tags'].latest + ' -g', function (error, stdout, stderr) {
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
        deleteFolderRecursive(__dirname + '/../current');

        copyDir(__dirname + '/../base', __dirname + '/../current');

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
    require('./tsc.js');
}

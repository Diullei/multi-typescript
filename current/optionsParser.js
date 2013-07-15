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

const { EventEmitter } = require('events');
const { Counter } = require("./utils");

const ProcessSymbols = {
    isEnd: Symbol('isEnd')
};
const processErrorCounter = Counter();

const ProcessError = {
  unknownCommand: processErrorCounter()
};

class Process extends EventEmitter {
    constructor({ connection, id }) {
        super();

        this.connection = connection;
        this.id = id;
    }

    message(command, ...data) {
        if (!this[ProcessSymbols.isEnd]) {
            if (typeof command === 'number') {
                return this.connection.send(command, this.id, ...data);
            } else {
                throw new Error(`First argument must be typeof <number>`);
            }
        }
    }

    get isLive() {
        return !this[ProcessSymbols.isEnd];
    }

    kill() {
        if (!this[ProcessSymbols.isEnd]) {
            this[ProcessSymbols.isEnd] = true;
            this.emit('end');
        }
    }
}

module.exports = {
    Process,
    ProcessError
}
const { createServer } = require('net');
const { EventEmitter } = require('events');
const { Connection } = require('./connection');
const { MultiplexConnection } = require('./multiplexConnection');
const { MessageClass, VarTypes } = require("sprut-buffer-structure");

const ServerSymbols = {
    connections: Symbol('connections'),
    connectionClass: Symbol('connectionClass'),
    beginOfMessage: Symbol('beginOfMessage'),
    messageClasses: Symbol('messageClasses')
}

class Server extends EventEmitter {
    constructor(config = {}) {
        super();

        this[ServerSymbols.connections] = [];

        const {
            port = 80,
            host = 'localhost',
            path,
            byteLength,
            isMultiplex,
        } = config;

        this.port = port;
        this.host = host;
        this.path = path;

        this[ServerSymbols.beginOfMessage] = MessageClass(isMultiplex ?
            {
                dataTypes: [
                    VarTypes.UNumber(byteLength.command),
                    VarTypes.UNumber(byteLength.id)
                ]
            }
            : {
                dataTypes: [
                    VarTypes.UNumber(byteLength.command)
                ]
            }
        );
        this[ServerSymbols.connectionClass] = isMultiplex ? MultiplexConnection : Connection;
        this[ServerSymbols.messageClasses] = {};

        for(let command in byteLength.commands) {
            this[ServerSymbols.messageClasses][command] = MessageClass({ dataTypes: [ ...byteLength.commands[command] ] });
        }
    }

    serve(server) {

    }

    start(startListener = () => {}) {
        this._server = createServer(baseServerHandler.bind(this));

        if(this.path) {
    		this._server.listen(this.path, () => {
                console.log(`Server listen on path ${this.path}.`);
                startListener.apply(this);
            });
        } else {
            this._server.listen(this.port, this.host, () => {
                console.log(`Server listen on ${this.host}:${this.port}.`);
                startListener.apply(this);
            });
        }
    }

    stop() {
        this._server.close();
    }

    forceStop() {
        this[ServerSymbols.connections].forEach(connection => {
            connection.close();
        });

        this.stop();
    }

    get messageClasses() {
        return {...this[ServerSymbols.messageClasses]};
    }
}

function baseServerHandler(socket) {
    const connection = new this[ServerSymbols.connectionClass](undefined, socket, this);

    this[ServerSymbols.connections].push(connection);
    socket.on('error', (error) => console.log('error', error))

    connection.setMessageClasses(this[ServerSymbols.messageClasses]);
    connection.setBeginOfMessage(this[ServerSymbols.beginOfMessage]);
    this.emit('connectionStart', connection);
}

module.exports = {
    Server
}
const { EventEmitter } = require('events');
const { MessageClass, VarTypes } = require('sprut-buffer-structure');
const { Process, ProcessError} = require('./process');
const { connect } = require('net');
//const { serviceCommandHandler } = require("./serviceCommandHandler");

const ReservedCommand = {
    255: () => {}
};

const ConnectionSymbols = {
    messageClasses: Symbol('MessageClasses'),
    beginOfMessage: Symbol('beginOfMessage')
};

class MultiplexConnection extends EventEmitter {
    constructor(config = {}, socket, server) {
        super();

        this._socket = socket;
        this._server = server;
        this._processes = {};
        this._handleUnknownCommand = server ? server.handleUnknownCommand : false;

        if (config.byteLength) {
            this[ConnectionSymbols.beginOfMessage] = MessageClass({
                dataTypes: [
                    VarTypes.UNumber(config.byteLength.command),
                    VarTypes.UNumber(config.byteLength.id)
                ]
            });
        }

        if (config.commands) {
            this[ConnectionSymbols.messageClasses] = {};

            for(let command in config.commands) {
                this[ConnectionSymbols.messageClasses][command] = MessageClass({ dataTypes: [ ...config.commands[command] ] });
            }
        }

        if(socket) {
            initSocketConnection(socket, this);
        }
    }

    get messageClasses() {
        return this[ConnectionSymbols.messageClasses];
    }

    get socket() {
        return this._socket;
    }

    get server() {
        return this._server;
    }

    setMessageClasses(messageClasses) {
        if(!this[ConnectionSymbols.messageClasses]) {
            this[ConnectionSymbols.messageClasses] = messageClasses;
        }
    }

    setBeginOfMessage(messageClass) {
        if(!this[ConnectionSymbols.beginOfMessage]) {
            this[ConnectionSymbols.beginOfMessage] = messageClass;
        }
    }

    send(command, id, ...data) {
        return this._socket.write(this.message(command, id, ...data));
    }

    message(command, id, ...data) {
        return Buffer.concat([
            new this[ConnectionSymbols.beginOfMessage](command, id).toBuffer(),
            new this[ConnectionSymbols.messageClasses][command](...data).toBuffer()
        ]);
    }

    serveSocket(socket) {
        this._socket = socket;
        socket.on('connection', () => {
            console.log(`Connection is succesfully.`);
        });

        initSocketConnection(this._socket, this);
    }

    tcpConnection({
        port = 80,
        host = 'localhost',
        path
    }, connectListener = () => {}) {
        if(this.path) {
    		this._socket = connect(path, () => {
                console.log(`Connection to server on path ${path} is succesfully.`);
                connectListener.apply(this);
            });
        } else {
            this._socket = connect(port, host, () => {
                console.log(`Connection to server ${host}:${port} is succesfully.`);
                connectListener.apply(this);
            });
        }

        initSocketConnection(this._socket, this);
    }

    createProcess(id) {
        initProcessConnection(new Process({ connection: this, id }), this);
    }

    handleConnectionCommand(command, values) {
        ReservedCommand[command].apply(this, [values]);
    }

    close() {
        this._socket?.end();
    }

    killProcess(id) {
        if (this._processes[id]) {
            this._processes[id].kill();
        }
    }
}

async function baseConnectionHandler(messageData) {
    if(!this[ConnectionSymbols.messageClasses]) {
        // todo
        throw new Error();
    }

    const [ baseMessageData, dataOffset ] = this[ConnectionSymbols.beginOfMessage].fromBuffer(messageData);
    const command = baseMessageData[0];
    const id = baseMessageData[1];

    if (!this._processes[id]) {
        initProcessConnection(new Process({
            connection: this,
            id,
            messageClass: this[ConnectionSymbols.messageClasses]
        }), this);
    }

    if (!this[ConnectionSymbols.messageClasses][command]) {
        this._processes[id].emit('errorRequest', `Unhandled message with command ${command}`, ProcessError.unknownCommand);
        return;
    }

    const [ dataValues ] = this[ConnectionSymbols.messageClasses][command].fromBuffer(messageData, dataOffset);
    const eventData = {
        values: dataValues,
        rawBuffer: messageData
    };

    if (!ReservedCommand[command]) {
        this._processes[id].emit('command', command, eventData);
        this._processes[id].emit(command, eventData);
    } else {
        this.handleConnectionCommand(command, dataValues);
    }
}

function initSocketConnection(socket, connection) {
    socket.on('end', () => connection.emit('end'));
    socket.on('close', () => connection.emit('close'));
    socket.on('data', data => baseConnectionHandler.apply(connection, [data]));
    socket.on('error', (error) => console.log('error', error));
}

function initProcessConnection(process, connection) {
    connection._processes[process.id] = process;
    connection.emit('processStart', process);
    process.once('end', deleteProcess.bind(undefined, connection, process));
}

function deleteProcess(connection, process) {
    delete this.killProcess(process.id);
}

module.exports = {
    MultiplexConnection
}
 'use strict';

var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;
var Hash = bitcore.crypto.Hash;

function Messages(options) {
  this.builder = Messages.builder(options);
  if (!options) {
    options = {};
  }
  var defaultMagicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);
  this.magicNumber = options.magicNumber || defaultMagicNumber;
}

Messages.MINIMUM_LENGTH = 20;
Messages.PAYLOAD_START = 16;
Messages.Message = require('./message');
Messages.builder = require('./builder');

Messages.prototype.build = Messages.prototype.buildFromObject = function(command, object) {
  return this.builder.commands[command].fromObject(object);
};

Messages.prototype.parseBuffer = function(dataBuffer) {
  /* jshint maxstatements: 18 */
  if (dataBuffer.length < Messages.MINIMUM_LENGTH) {
    return;
  }

  // Search the next magic number
  if (!this._discardUntilNextMessage(dataBuffer)) return;

  var payloadLen = (dataBuffer.get(Messages.PAYLOAD_START)) +
    (dataBuffer.get(Messages.PAYLOAD_START + 1) << 8) +
    (dataBuffer.get(Messages.PAYLOAD_START + 2) << 16) +
    (dataBuffer.get(Messages.PAYLOAD_START + 3) << 24);

  var messageLength = 24 + payloadLen;
  if (dataBuffer.length < messageLength) {
    return;
  }

  var command = dataBuffer.slice(4, 16).toString('ascii').replace(/\0+$/, '');
  var payload = dataBuffer.slice(24, messageLength);
  var checksum = dataBuffer.slice(20, 24);

  var checksumConfirm = Hash.sha256sha256(payload).slice(0, 4);
  if (!BufferUtil.equals(checksumConfirm, checksum)) {
    dataBuffer.skip(messageLength);
    return;
  }

  dataBuffer.skip(messageLength);

  return this._buildFromBuffer(command, payload);
};

Messages.prototype._discardUntilNextMessage = function(dataBuffer) {
  var i = 0;
  for (;;) {
    // check if it's the beginning of a new message
    var packageNumber = dataBuffer.slice(0, 4).readUInt32LE(0);
    if (packageNumber === this.magicNumber) {
      dataBuffer.skip(i);
      return true;
    }

    // did we reach the end of the buffer?
    if (i > (dataBuffer.length - 4)) {
      dataBuffer.skip(i);
      return false;
    }

    i++; // continue scanning
  }
};

Messages.prototype._buildFromBuffer = function(command, payload) {
  if (!this.builder.commands[command]) {
    throw new Error('Unsupported message command: ' + command);
  }
  return this.builder.commands[command].fromBuffer(payload);
};

module.exports = Messages;
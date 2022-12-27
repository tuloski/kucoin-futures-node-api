"use strict";

const Websocket = require("./lib/websocket.js");
const Kucoin = require("./lib/kucoin.js");

module.exports = {
    default: Kucoin,
    Websocket,
    Kucoin
};
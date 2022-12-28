const kucoin_futures_api = require('./lib/kucoin');
const kucoin_websocket = require('./lib/websockets');

const config = {
    apiKey: 'xXXXXXXXXXXXXXXXXXXXXxxxxxxxxxxxxxxxxxxxxxXXX',
    secretKey: 'xxxxxxxxXXXXXXXXXXXXXxxXXXXXXXXXXXXXxxxXXX',
    passphrase: 'xxxxxx',
    environment: 'live'
}

const config_ws = {
    //apiKey: 'xXXXXXXXXXXXXXXXXXXXXxxxxxxxxxxxxxxxxxxxxxXXX',  //USE keys for private channels ws
    //secretKey: 'xxxxxxxxXXXXXXXXXXXXXxxXXXXXXXXXXXXXxxxXXX',
    //passphrase: 'xxxxxx'
}

const api_kucoin = new kucoin_futures_api();
api_kucoin.init(config);

const ws_kucoin = new kucoin_websocket(config_ws);

ws_kucoin.on('execution', (data) => {
    console.log("Got message execution: " + JSON.stringify(data));
});
ws_kucoin.on('instrument', (data) => {
    console.log("Got message instrument: " + JSON.stringify(data));
});
//ws_kucoin.on('ack', (data) => {
//    console.log("Got message ack: " + JSON.stringify(data));
//});
ws_kucoin.on('open', async () => {
    ws_kucoin.subscribe("execution", 'XBTUSDTM');
    ws_kucoin.subscribe("instrument", 'XBTUSDTM');
});
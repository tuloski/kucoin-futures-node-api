const kucoin_futures_api = require('./lib/kucoin');
const kucoin_websocket = require('./lib/websockets');

const config = {
    apiKey: 'xXXXXXXXXXXXXXXXXXXXXxxxxxxxxxxxxxxxxxxxxxXXX',
    secretKey: 'xxxxxxxxXXXXXXXXXXXXXxxXXXXXXXXXXXXXxxxXXX',
    passphrase: 'xxxxxx',
    environment: 'live'
}

const config_ws = {
    //apiKey: 'xXXXXXXXXXXXXXXXXXXXXxxxxxxxxxxxxxxxxxxxxxXXX',
    //secretKey: 'xxxxxxxxXXXXXXXXXXXXXxxXXXXXXXXXXXXXxxxXXX',
    //passphrase: 'xxxxxx'
}

const api_kucoin = new kucoin_futures_api();
api_kucoin.init(config);



//OLD

/*api_kucoin.initSocket({topic: "execution", symbols: ['XBTUSDTM']}, (msg) => {
    let data = JSON.parse(msg);
    //console.log(data);
    console.log("Got data execution.");
});
api_kucoin.initSocket({topic: "market", symbols: ['XBTUSDTM']}, (msg) => {
    let data = JSON.parse(msg);
    //console.log(data);
    console.log("Got data market.");
});*/

//NEW
const ws_kucoin = new kucoin_websocket(config_ws);
ws_kucoin.on('open', async () => {
    ws_kucoin.subscribe("execution", 'XBTUSDM');
    ws_kucoin.subscribe("instrument", 'XBTUSDM');
});


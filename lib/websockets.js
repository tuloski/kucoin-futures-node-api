const Ws = require('ws');
const axios = require('axios');
const EventEmitter = require("events");
const crypto = require('crypto');

// -------- OLD -------------

/*const Sockets = {}
Sockets.ws = {}
Sockets.heartbeat = {}

getPublicWsToken = async function (baseURL) {
  let endpoint = '/api/v1/bullet-public'
  let url = baseURL + endpoint
  let result = await axios.post(url, {})
  return result.data
}

getPrivateWsToken = async function (baseURL, sign) {
  let endpoint = '/api/v1/bullet-private'
  let url = baseURL + endpoint
  let result = await axios.post(url, {}, sign)
  return result.data
}

getSocketEndpoint = async function (type, baseURL, environment, sign) {
  let r
  if (type == 'private') {
    r = await getPrivateWsToken(baseURL, sign)
  } else {
    r = await getPublicWsToken(baseURL)
  }
  let token = r.data.token
  let instanceServer = r.data.instanceServers[0]

  if (instanceServer) {
    if (environment === 'sandbox') {
      return `${instanceServer.endpoint}?token=${token}&[connectId=${Date.now()}]`
    } else if (environment === 'live') {
      return `${instanceServer.endpoint}?token=${token}&[connectId=${Date.now()}]`
    }
  } else {
    throw Error("No Kucoin WS servers running")
  }
}

  //Initiate a websocket
  //params = {
  //  topic: enum
  //  symbols: array [optional depending on topic]
  //}
  //eventHanlder = function
Sockets.initSocket = async function (params, eventHandler) {
  try {
    if (!params.sign) params.sign = false;
    if (!params.endpoint) params.endpoint = false;
    let [topic, endpoint, type] = Sockets.topics(params.topic, params.symbols, params.endpoint, params.sign)
    let sign = this.sign('/api/v1/bullet-private', 'POST', {})
    let websocket = await getSocketEndpoint(type, this.baseURL, this.environment, sign)
    let ws = new WebSocket(websocket)

    ws.on('open', () => {
      Sockets.ws[topic] = ws
      console.log(topic + ' opening websocket connection... ')
      Sockets.subscribe(topic, endpoint, type, eventHandler)
      Sockets.ws[topic].heartbeat = setInterval(Sockets.socketHeartBeat, 20000, topic)
    })
    ws.on('error', (error) => {
      Sockets.handleSocketError(error)
      console.log("WS ERROR!")
      console.log(error)
    })
    ws.on('ping', () => {
      return
    })
    ws.on('pong', () => {
      console.log("WS received pong! " + topic);
    })
    ws.on('close', () => {
      clearInterval(Sockets.ws[topic].heartbeat)
      console.log(topic + ' websocket closed!')
    })
  } catch (err) {
    console.log(err)
  }
}

Sockets.handleSocketError = function (error) {
  console.log('WebSocket error: ' + (error.code ? ' (' + error.code + ')' : '') +
    (error.message ? ' ' + error.message : ''))
}

Sockets.socketHeartBeat = function (topic) {
  let ws = Sockets.ws[topic]
  ws.ping()
}

Sockets.subscribe = async function (topic, endpoint, type, eventHandler) {
  let ws = Sockets.ws[topic]
  if (type === 'private') {
    ws.send(JSON.stringify({
      id: Date.now(),
      type: 'subscribe',
      topic: endpoint,
      privateChannel: true,
      response: true
    }))
  } else {
    ws.send(JSON.stringify({
      id: Date.now(),
      type: 'subscribe',
      topic: endpoint,
      response: true
    }))
  }
  ws.on('message', eventHandler)
}

Sockets.unsubscribe = async function (topic, endpoint, type, eventHandler) {
  let ws = Sockets.ws[topic]
  ws.send(JSON.stringify({
    id: Date.now(),
    type: 'unsubscribe',
    topic: endpoint,
    response: true
  }))
  ws.on('message', eventHandler)
}

Sockets.topics = function (topic, symbols = [], endpoint = false, sign = false) {
  if (endpoint) return [topic, endpoint + (symbols.length > 0 ? ':' : '') + symbols.join(','), sign ? 'private' : 'public']
  if (topic === 'ticker') {
    return [topic, "/contractMarket/ticker:" + symbols[0], 'public']
  } else if (topic === 'tickerv2') {
    return [topic, "/contractMarket/tickerV2:" + symbols[0], 'public']
  } else if (topic === 'orderbook') {
    return [topic, "/contractMarket/level2:", + symbols[0], 'public']
  } else if (topic === 'execution') {
    return [topic, "/contractMarket/execution:" + symbols[0], 'public']
  } else if (topic === 'fullMatch') {
    return [topic, "/contractMarket/level3v2:" + symbols[0], 'public']
  } else if (topic === 'depth5') {
    return [topic, "/contractMarket/level2Depth5:" + symbols[0], 'public']
  } else if (topic === 'depth50') {
    return [topic, "/contractMarket/level2Depth50" + symbols[0], 'public']
  } else if (topic === 'market') {
    return [topic, "/contract/instrument:" + symbols[0], 'public']
  } else if (topic === 'announcement') {
    return [topic, "/contract/announcement", 'public']
  } else if (topic === 'snapshot') {
    return [topic, "/contractMarket/snapshot:" + symbols[0], 'public']
  } else if (topic === 'ordersMarket') {
    return [topic, "/contractMarket/tradeOrders:" + symbols[0], 'private']
  } else if (topic === 'orders') {
    return [topic, "/contractMarket/tradeOrders", 'private']
  } else if (topic === 'advancedOrders') {
    return [topic, "/contractMarket/advancedOrders", 'private']
  } else if (topic === 'balances') {
    return [topic, "/contractAccount/wallet", 'private']
  } else if (topic === 'position') {
    return [topic, "/contract/position:" + symbols[0], 'private']
  }
}

module.exports = Sockets*/

// ------- NEW ---------------

class Websocket extends EventEmitter {

	constructor(params){
		super();

		this.ws;
		this.params = params;
		this.id_sub = 0;
		this.base_url = 'https://api-futures.kucoin.com';
		this.endpoint = "";
		this.pongReceiveInterval;
		this.state = "closed";      //"closed", "opening", "open"
		this.pong_lost = 0;
		this.waiting_pong = false;
		this.private = false;	
		this.createWebsocket();        
    }

	getPublicWsToken = async function (){
		let endpoint = '/api/v1/bullet-public';
		let url = this.base_url + endpoint;
		let result = await axios.post(url, {});
		return result.data;
	}
	  
	getPrivateWsToken = async function (sign){
		let endpoint = '/api/v1/bullet-private'
		let url = this.base_url + endpoint;
		let result = await axios.post(url, {}, sign);
		return result.data;
	}
	  
	getSocketEndpoint = async function (sign){
		let r;
		if (this.private) {
		  	r = await this.getPrivateWsToken(sign);
		} else {
		  	r = await this.getPublicWsToken();
		}
		console.log("R: " + JSON.stringify(r));
		let token = r.data.token;
		let instanceServer = r.data.instanceServers[0];
	  
		if (instanceServer) {
			return `${instanceServer.endpoint}?token=${token}&[connectId=${Date.now()}]`;
		} else {
		  	throw Error("No Kucoin WS servers running");
		}
	}

	sign(endpoint, method, params = {}){
		let header = {
			headers: {
				'Content-Type': 'application/json'
		  	}
		}
		let nonce = Date.now() + ''
		let strForSign = ''
		if (method === 'GET' || method === 'DELETE') {
			strForSign = nonce + method + endpoint + this.formatQuery(params)
		} else {
			strForSign = nonce + method + endpoint + JSON.stringify(params)
		}
		let signatureResult = crypto.createHmac('sha256', this.secretKey)
			.update(strForSign)
			.digest('base64')
		let passphraseResult = crypto.createHmac('sha256', this.secretKey)
			.update(this.passphrase)
			.digest('base64')
		header.headers['KC-API-SIGN'] = signatureResult
		header.headers['KC-API-TIMESTAMP'] = nonce
		header.headers['KC-API-KEY'] = this.apiKey
		header.headers['KC-API-PASSPHRASE'] = passphraseResult
		header.headers['KC-API-KEY-VERSION'] = 2
		return header
	}

    async createWebsocket(){
        this.state = "opening";

		if (this.params.hasOwnProperty("apiKey")){
			this.private = true;
			let sign = this.sign('/api/v1/bullet-private', 'POST', {});		//TODO fix
			this.endpoint = await this.getSocketEndpoint(sign);
			console.log("ENDPOINT PRIVATE: " + JSON.stringify(this.endpoint));
		} else {
			this.endpoint = await this.getSocketEndpoint();
			console.log("ENDPOINT PUBLIC: " + JSON.stringify(this.endpoint));
		}

        if (this.ws != undefined){
            console.log("Kucoin Websocket removing listeners");
            this.ws.removeAllListeners();
        }
        try{
            this.ws = new Ws(this.endpoint);
        } catch (e){
            console.log("Error creating websocket: " + e);
        }

        this.ws.on('open', function() {
            console.log("Kucoin Websocket opened. State: " + this.state);
            setTimeout(this.ping.bind(this), 18000);	//TODO use param received when connected. See docs
            this.state = "open";            
            this.emit('open');
        }.bind(this));

        this.ws.on('close', function(reason) {
            console.log("Kucoin Websocket Closed: " + reason);
            if (this.state != "closed"){
                this.state = "closed";
                clearTimeout(this.pongReceiveInterval);                   
                this.ws.terminate();
                console.log("Kucoin Websocket emitting close for close");
                this.emit('close', reason);
                this.reconnect();           
            }
        }.bind(this));

        this.ws.on('error', function(err) {
            console.log("Kucoin Websocket Error: " + err);
            if (this.state != "closed"){
                this.state = "closed";
                clearTimeout(this.pongReceiveInterval);
                this.ws.terminate();
                console.log("Kucoin Websocket emitting close for error");
                this.emit('close', err);
                this.reconnect();
            }
        }.bind(this));

        this.ws.on('ping', function(data) {
            try{
                this.ws.pong();
            } catch (err){
                //TODO something?
            }
            //console.log("Kucoin Websocket Received Ping: " + data);
            this.emit('ping', data);
        }.bind(this));

        this.ws.on('pong', function(data) {
            //console.log("Kucoin Websocket Received Pong: " + data);
            this.pong_lost = 0;
            clearTimeout(this.pongReceiveInterval);
            if (this.waiting_pong){ //Otherwise we risk that we are receiving random pongs and for each sending a new ping
                this.waiting_pong = false;
                setTimeout(this.ping.bind(this), 18000);	//TODO use param received when connected. See docs
            }
        }.bind(this));

        this.ws.on('unexpected-response', (req,res) => {
            console.log("Kucoin Websocket unexpected. Request: " + req + ". Response: " + res);
        });

        this.ws.on('message', function(msg) {
			//TODO for kucoin
            console.log("Incoming message: " + msg);            
            /*var data = JSON.parse(msg);
            if (data.event == "bts:request_reconnect"){
                console.log("Kucoin Websocket received request reconnect.");
                if (this.state != "closed"){
                    this.ws.terminate();        
                    clearTimeout(this.pongReceiveInterval);
                    this.state = "closed";
                    console.log("Kucoin Websocket emitting close for reconnect");
                    this.emit('close', "bts:request_reconnect");
                    this.reconnect();
                }
                return;
            }
            //console.log("CHANNEL: " + JSON.stringify(data,null,2));
            let channel = data.channel.split("_");
            let chan = "";
            for (var i=0; i<channel.length-1; i++){
                chan += channel[i];
                if (i<channel.length-2){
                    chan += "_";
                }
            }
            let event = "";
            switch (chan){
                case "live_trades":
                event = "ticker";
                break;

                case "live_orders":
                event = "order";
                break;

                case "order_book":
                event = "book";
                break;

                case "detail_order_book":
                event = "detail_book"
                break;

                case "diff_order_book":
                event = "full_book"
                break;
            }
            this.emit(event,data);*/
        }.bind(this));   
    }

    reconnect(){
        if (this.state == "closed"){
            try{
                console.log("Kucoin Websocket: trying to reconnect.");
                this.createWebsocket();
            } catch (e){
                console.log("Error creating websocket: " + e);
            }
        }
    }

    subscribe(topic, symbol){
		//TODO revamp for kucoin
        if (this.state == "open"){
            var topic_sub;
            switch (topic){
                case "tickerV2":
                    topic_sub = "/contractMarket/tickerV2:" + symbol;
                    break;

                case "ticker":
                    topic_sub = "/contractMarket/ticker:" + symbol;
                    break;

                case "level2":
                    topic_sub = "/contractMarket/level2:" + symbol;
                    break;

                case "execution":
                    topic_sub = "/contractMarket/execution:" + symbol;
                    break;

                case "level2Depth5":
                    topic_sub = "/contractMarket/level2Depth5:" + symbol;
                    break;
				
				case "level2Depth50":
					topic_sub = "/contractMarket/level2Depth50:" + symbol;
					break;

				case "instrument":
					topic_sub = "/contract/instrument:" + symbol;
					break;

				case "announcement":
					topic_sub = "/contract/announcement" + symbol;
					break;
				
				case "snapshot":
					topic_sub = "/contractMarket/snapshot:" + symbol;
					break;

                default:
                    console.log("Kucoin Websocket: Wrong type of subscription!");
                    return;
            }
			if (this.private){
				this.ws.send(JSON.stringify({
					id: this.id_sub++,
					type: 'subscribe',
					topic: topic_sub,
					privateChannel: true,
					response: true
				}))
			} else {
				this.ws.send(JSON.stringify({
				  id: this.id_sub++,
				  type: 'subscribe',
				  topic: topic_sub,
				  response: true
				}))
			}
        } else {
            console.log("Not connected! Cannot subscribe!");
        }     
    }

	unsubscribe(){
		//TODO
	}

    noPong(){    
        this.waiting_pong = false;    
        this.pong_lost++;
        console.log("Kucoin Websocket lost pingpong " + this.pong_lost);
        if (this.pong_lost >= 2){           //Wait to lose 2 consecutive pong
            if (this.state != "closed"){
                this.state = "closed";
                clearTimeout(this.pongReceiveInterval);
                this.ws.terminate();
                console.log("Kucoin Websocket emitting close for no pong");
                this.emit('close', "no_pong"); 
                this.reconnect();           
            }
        } else {
            setTimeout(this.ping.bind(this), 18000);	//TODO use param received when connected. See docs
        }                
    }

    ping(){
        if (this.state == "open"){
            try{
                this.ws.ping();
                /*this.ws.send(JSON.stringify(
                    {
                        "event": "bts:heartbeat"
                    })    
                );*/
                this.waiting_pong = true;
                //console.log("Kucoin Websocket sent ping");
                this.pongReceiveInterval = setTimeout(this.noPong.bind(this), 5000);    //TODO use param received when connected. See docs            
            } catch (err){
                //Sometimes the WS is closed but we don't get the event and ping can fail
            }
        }  else {
            console.log("Kucoin Websocket ping failed not open yet");
        }
    }

    pong(){
        this.ws.pong();
    }

    close(){
        this.ws.terminate();
    }
}

module.exports = Websocket;
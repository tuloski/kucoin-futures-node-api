const Ws = require('ws');
const qs = require('querystring');
const axios = require('axios');
const EventEmitter = require("events");
const crypto = require('crypto');

//TODO limit at 300 topics subscriptions. Add new WS afterward or notify the user.

/*Sockets.unsubscribe = async function (topic, endpoint, type, eventHandler) {
  let ws = Sockets.ws[topic]
  ws.send(JSON.stringify({
    id: Date.now(),
    type: 'unsubscribe',
    topic: endpoint,
    response: true
  }))
  ws.on('message', eventHandler)
}*/

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

	sign(endpoint, method, key, params = {}){
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
		let signatureResult = crypto.createHmac('sha256', key.secretKey)
			.update(strForSign)
			.digest('base64')
		let passphraseResult = crypto.createHmac('sha256', key.secretKey)
			.update(key.passphrase)
			.digest('base64')
		header.headers['KC-API-SIGN'] = signatureResult
		header.headers['KC-API-TIMESTAMP'] = nonce
		header.headers['KC-API-KEY'] = key.apiKey
		header.headers['KC-API-PASSPHRASE'] = passphraseResult
		header.headers['KC-API-KEY-VERSION'] = 2
		return header
	}

	formatQuery(queryObj) {
		if (queryObj !== undefined && JSON.stringify(queryObj).length !== 2) {
		  	return '?' + qs.stringify(queryObj)
		} else {
		  	return ''
		}
	}

    async createWebsocket(){
        this.state = "opening";
		if (this.params.hasOwnProperty("apiKey")){
			this.private = true;
			let sign = this.sign('/api/v1/bullet-private', 'POST', this.params, {});
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
            setTimeout(this.ping.bind(this), 3000);	//TODO use param received when connected. See docs
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
                setTimeout(this.ping.bind(this), 3000);	//TODO use param received when connected. See docs
            }
        }.bind(this));

        this.ws.on('unexpected-response', (req,res) => {
            console.log("Kucoin Websocket unexpected. Request: " + req + ". Response: " + res);
        });

        this.ws.on('message', function(msg) {
			var data = JSON.parse(msg);
            //console.log("Incoming message: " + msg);
			if (data.type === "ack"){
				this.emit("ack", data.id);
			}
			if (data.type === "message"){
				let event = "";
				let data_to_send = {};
				switch (data.subject){
					case ('mark.index.price'):
						event = "instrument";
						data_to_send = data.data;
						data_to_send.symbol = data.topic.split(":")[1];
						break;

					case ('match'):
						event = "execution";
						data_to_send = data.data;
						break;

					case ('level2'):
						event = data.subject;
						data_to_send = data.data;
						data_to_send.symbol = data.topic.split(":")[1];
						break;

					case ('funding.begin'):
						event = "announcement";			//TODO documentation wrong probably
						data_to_send = data.data;
						break;

					case ('snapshot.24h'):
						event = "snapshot";
						data_to_send = data.data;
						data_to_send.symbol = data.topic.split(":")[1];
						break;

					default:
						event = data.subject;
						data_to_send = data.data;
						break;
				}
				this.emit(event, data_to_send);
			}
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
            setTimeout(this.ping.bind(this), 3000);	//TODO use param received when connected. See docs
        }                
    }

    ping(){
        if (this.state == "open"){
            try{
                this.ws.ping();
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
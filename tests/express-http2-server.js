/* global Promise, Proxy */
"use strict";

var _ = require("underscore");
var chai = require("chai");

var expect = chai.expect;

var expressHTTP2Workaround = require('../');

var originalDescribe = describe;
(function(){
	try{
		var nodeHTTP2Bindings = process.binding('http2');
		var http2 = require('http2');
		if(http2.constants===nodeHTTP2Bindings.constants && 'NGHTTP2_SESSION_SERVER' in nodeHTTP2Bindings.constants){
			describe = describe.skip;
			console.warn("WARN: node http2 is exposed, this version of node has http2 support. Test Skipped.");
			process.exit(1); // Fail for now
		}
	}catch(err){}
})();

var httpPort = null, httpsPort = null;
describe('preparing tests',function(){
	it('find available ports',function(done){
		var portastic = require('portastic');
		portastic.find({
			min: 60000, max:65534, retrieve:2
		}).then(function(ports){
			if(!ports || ports.length<2) done("Unable to find 2 available ports to host on");
			else {
				httpPort = ports[0];
				httpsPort = ports[1];
				done();
			}
		}).catch(function(err){
			done("Unable to find 2 available ports to host on: "+err);
		});
	});
});

// Require Modules 
var fs = require('fs');
var express = require('express');
var http = require('http');
var http2 = require('http2');
var httpsOptions = {
	//log: { fatal: console.error.bind(console), error: console.error.bind(console), warn : console.warn.bind(console), info : console.log.bind(console), debug: console.log.bind(console), trace: console.log.bind(console), child: function() { return this; } },
	'key' : fs.readFileSync(__dirname + '/httpsFakeKeys/server.key'),
	'cert' : fs.readFileSync(__dirname + '/httpsFakeKeys/server.crt'),
	'ca' : fs.readFileSync(__dirname + '/httpsFakeKeys/server.crt')
};

describe('express http2 server WITHOUT express-http2-workaround',function(){
	var app, httpServer, http2Server;
	var resDoneHandler;
	
	it('should start server',function(done){
		done = _.once(done);
		var doneTick = _.after(3,done);
		// Create Express Application
		app = express();
		// Setup HTTP/1.x Server
		httpServer = http.Server(app);
		httpServer.listen(httpPort,function(){
			doneTick();
		});
		// Setup HTTP/2 Server
		http2Server = http2.createServer(httpsOptions,app);
		http2Server.listen(httpsPort,function(){
			doneTick();
		});
		// Serve some content
		app.get('/', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		doneTick();
	});
	
	it('should not error on http 1 requests',function(done){
		done = _.once(done);
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http1 request
		var http1Request = http.request({
			host: 'localhost',
			port: httpPort,
			path: '/',
			timeout: 1000
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:1.1');
				done();
			});
		});
		http1Request.on('error',function(err){
			done("http1 request error: "+err);
		});
		http1Request.end();
	});
	
	it('should error on http 2 requests',function(done){
		done = _.once(done);
		var http2Request;
		resDoneHandler = function(err){
			if(err) done();
			else done("Response succeeded?");
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				if(dataStr==='HTTP:2.0') done("Correct response received when it was supposed to error");
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should stop server',function(done){
		done = _.once(done);
		if(resDoneHandler) resDoneHandler = null;
		var doneTick = _.after(3,done);
		httpServer.once('close',doneTick);
		http2Server.once('close',doneTick);
		httpServer.close();
		// Close all http2 request endpoints
		for(var key in http2.globalAgent.endpoints){
			var endpoint = http2.globalAgent.endpoints[key];
			endpoint._connection.close('NO_ERROR');
			endpoint.socket.end();
		}
		http2.globalAgent.endpoints = {};
		http2Server.close();
		doneTick();
	});
	
});

describe('express http2 server WITH express-http2-workaround',function(){
	var app, httpServer, http2Server;
	var resDoneHandler;
	
	it('should start server',function(done){
		done = _.once(done);
		var doneTick = _.after(3,done);
		// Create Express Application
		app = express();
		// Make HTTP2 work with Express
		expressHTTP2Workaround({ express:express, http2:http2, app:app });
		// Setup HTTP/1.x Server
		httpServer = http.Server(app);
		httpServer.listen(httpPort,function(){
			doneTick();
		});
		// Setup HTTP/2 Server
		http2Server = http2.createServer(httpsOptions,app);
		http2Server.listen(httpsPort,function(){
			doneTick();
		});
		// Serve some content
		app.get('/', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		doneTick();
	});
	
	it('should not error on http 1 requests',function(done){
		done = _.once(done);
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http1 request
		var http1Request = http.request({
			host: 'localhost',
			port: httpPort,
			path: '/',
			timeout: 1000
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:1.1');
				done();
			});
		});
		http1Request.on('error',function(err){
			done("http1 request error: "+err);
		});
		http1Request.end();
	});
	
	it('should not error on http 2 requests',function(done){
		done = _.once(done);
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				done();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should stop server',function(done){
		done = _.once(done);
		if(resDoneHandler) resDoneHandler = null;
		var doneTick = _.after(3,done);
		httpServer.once('close',doneTick);
		http2Server.once('close',doneTick);
		httpServer.close();
		// Close all http2 request endpoints
		for(var key in http2.globalAgent.endpoints){
			var endpoint = http2.globalAgent.endpoints[key];
			endpoint._connection.close('NO_ERROR');
			endpoint.socket.end();
		}
		http2.globalAgent.endpoints = {};
		http2Server.close();
		doneTick();
	});
	
});

/*
describe('sub express application WITHOUT express-http2-workaround on sub app (first middleware on main app), but it IS on main app (after sub app has been added)',function(){
	var app, httpServer, http2Server, subApp;
	var resDoneHandler, expressHTTP2WorkaroundMiddleware;
	
	it('should start server (attached via app.use directly)',function(done){
		done = _.once(done);
		var doneTick = _.after(3,done);
		// Create Express Application
		app = express();
		// Sub Express App
		subApp = express();
		app.use(subApp); // If this is below the expressHTTP2Workaround, then it may work
		// Make HTTP2 work with Express (only on main app)
		expressHTTP2WorkaroundMiddleware = expressHTTP2Workaround({ express:express, http2:http2 });
		app.use(expressHTTP2WorkaroundMiddleware);
		// Setup HTTP/1.x Server
		httpServer = http.Server(app);
		httpServer.listen(httpPort,function(){
			doneTick();
		});
		// Setup HTTP/2 Server
		http2Server = http2.createServer(httpsOptions,app);
		http2Server.listen(httpsPort,function(){
			doneTick();
		});
		// Serve some content
		app.get('/mainapp', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		subApp.get('/subapp', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		doneTick();
	});
	
	it('should not error on http 2 requests to main express app',function(done){
		done = _.once(done);
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/mainapp',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				done();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should error on http 2 requests to sub express app',function(done){
		done = _.once(done);
		var http2Request;
		resDoneHandler = function(err){
			if(err) done();
			else done("Response succeeded?");
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/subapp',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				if(dataStr==='HTTP:2.0') done("Correct response received when it was supposed to error");
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should stop server',function(done){
		done = _.once(done);
		if(resDoneHandler) resDoneHandler = null;
		var doneTick = _.after(3,done);
		httpServer.once('close',doneTick);
		http2Server.once('close',doneTick);
		httpServer.close();
		// Close all http2 request endpoints
		for(var key in http2.globalAgent.endpoints){
			var endpoint = http2.globalAgent.endpoints[key];
			endpoint._connection.close('NO_ERROR');
			endpoint.socket.end();
		}
		http2.globalAgent.endpoints = {};
		http2Server.close();
		doneTick();
	});
	
});
*/

describe('sub express application WITH express-http2-workaround on sub app and main app',function(){
	var app, httpServer, http2Server, subApp;
	var resDoneHandler, expressHTTP2WorkaroundMiddleware;
	
	it('should start server (attached via app.use directly)',function(done){
		done = _.once(done);
		var doneTick = _.after(3,done);
		// Create Express Application
		app = express();
		// Make HTTP2 work with Express
		expressHTTP2WorkaroundMiddleware = expressHTTP2Workaround({ express:express, http2:http2 });
		app.use(expressHTTP2WorkaroundMiddleware);
		// Setup HTTP/1.x Server
		httpServer = http.Server(app);
		httpServer.listen(httpPort,function(){
			doneTick();
		});
		// Setup HTTP/2 Server
		http2Server = http2.createServer(httpsOptions,app);
		http2Server.listen(httpsPort,function(){
			doneTick();
		});
		// Sub Express App
		subApp = express();
		// Make HTTP2 work with Sub Express App
		subApp.use(expressHTTP2WorkaroundMiddleware);
		app.use(subApp);
		// Serve some content
		subApp.get('/mainapp', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		subApp.get('/subapp', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		doneTick();
	});
	
	it('should not error on http 2 requests to main express app',function(done){
		done = _.once(done);
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/mainapp',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				done();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should not error on http 2 requests to sub express app',function(done){
		done = _.once(done);
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/subapp',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				done();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should stop server',function(done){
		done = _.once(done);
		if(resDoneHandler) resDoneHandler = null;
		var doneTick = _.after(3,done);
		httpServer.once('close',doneTick);
		http2Server.once('close',doneTick);
		httpServer.close();
		// Close all http2 request endpoints
		for(var key in http2.globalAgent.endpoints){
			var endpoint = http2.globalAgent.endpoints[key];
			endpoint._connection.close('NO_ERROR');
			endpoint.socket.end();
		}
		http2.globalAgent.endpoints = {};
		http2Server.close();
		doneTick();
	});
	
});

describe('express-http2-workaround features',function(){
	var app, httpServer, http2Server;
	var resDoneHandler, expressHTTP2WorkaroundMiddleware;
	
	it('should start server (attached via app.use directly)',function(done){
		done = _.once(done);
		var doneTick = _.after(3,done);
		// Create Express Application
		app = express();
		// Make HTTP2 work with Express
		expressHTTP2WorkaroundMiddleware = expressHTTP2Workaround({ express:express, http2:http2 });
		app.use(expressHTTP2WorkaroundMiddleware);
		// Setup HTTP/1.x Server
		httpServer = http.Server(app);
		httpServer.listen(httpPort,function(){
			doneTick();
		});
		// Setup HTTP/2 Server
		http2Server = http2.createServer(httpsOptions,app);
		http2Server.listen(httpsPort,function(){
			doneTick();
		});
		// Serve some content
		app.get('/', function(req,res){
			try{
				res.send('HTTP:'+req.httpVersion);
				if(resDoneHandler) resDoneHandler(false);
			}catch(err){
				if(resDoneHandler) resDoneHandler(err);
			}
			try{ res.end(); }catch(err){}
		});
		doneTick();
	});
	
	it("has instance.requestHTTP2 not equal express.request (both same required file)",function(){
		expect(expressHTTP2WorkaroundMiddleware.instance.requestHTTP2).to.not.equal(express.request);
	});
	
	it("has instance.responseHTTP2 not equal express.response (both same required file)",function(){
		expect(expressHTTP2WorkaroundMiddleware.instance.responseHTTP2).to.not.equal(express.response);
	});
	
	it("has instance.requestHTTP2's [[Prototype]] as http2.IncomingMessage.prototype",function(){
		expect(Object.getPrototypeOf(expressHTTP2WorkaroundMiddleware.instance.requestHTTP2)).to.equal(http2.IncomingMessage.prototype);
	});
	
	it("has instance.responseHTTP2's [[Prototype]] as http2.ServerResponse.prototype",function(){
		expect(Object.getPrototypeOf(expressHTTP2WorkaroundMiddleware.instance.responseHTTP2)).to.equal(http2.ServerResponse.prototype);
	});
	
	it("has instance.http2 as http2",function(){
		expect(expressHTTP2WorkaroundMiddleware.instance.http2).to.equal(http2);
	});
	
	it("has instance.express as express",function(){
		expect(expressHTTP2WorkaroundMiddleware.instance.express).to.equal(express);
	});
	
	it("has a server request request-object have [[Prototype]] of instance.requestHTTP2 (which has its [[Prototype]] as http2.IncomingMessage.prototype)",function(done){
		done = _.once(done);
		var doneTick = _.after(2,done);
		app.get('/test-requestHTTP2', function(req,res){
			expect(Object.getPrototypeOf(req)).to.equal(expressHTTP2WorkaroundMiddleware.instance.requestHTTP2);
			expect(Object.getPrototypeOf(Object.getPrototypeOf(req))).to.equal(http2.IncomingMessage.prototype);
			doneTick();
			try{ res.end(); }catch(err){}
		});
		// Start request
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/test-requestHTTP2',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			doneTick();
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it("has a server request response-object have [[Prototype]] of instance.responseHTTP2 (which has its [[Prototype]] as http2.ServerResponse.prototype)",function(done){
		done = _.once(done);
		var doneTick = _.after(2,done);
		app.get('/test-responseHTTP2', function(req,res){
			expect(Object.getPrototypeOf(res)).to.equal(expressHTTP2WorkaroundMiddleware.instance.responseHTTP2);
			expect(Object.getPrototypeOf(Object.getPrototypeOf(res))).to.equal(http2.ServerResponse.prototype);
			doneTick();
			try{ res.end(); }catch(err){}
		});
		// Start request
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/test-responseHTTP2',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			doneTick();
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('can have internal middleware method be modified',function(done){
		done = _.once(done);
		var doneTick = _.after(2,done);
		// Modify internal middleware
		var oldMiddleware = expressHTTP2WorkaroundMiddleware.instance.middleware;
		var boundMiddleware = oldMiddleware.bind(expressHTTP2WorkaroundMiddleware.instance);
		expressHTTP2WorkaroundMiddleware.instance.middleware = function(req, res, next){
			boundMiddleware(req, res, next);
			doneTick();
			// Set original middleware
			expressHTTP2WorkaroundMiddleware.instance.middleware = oldMiddleware;
		};
		// Start request
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				doneTick();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('can have internal setRequestAsHTTP2 method be modified',function(done){
		done = _.once(done);
		var doneTick = _.after(2,done);
		// Modify internal setRequestAsHTTP2
		var oldSetRequestAsHTTP2 = expressHTTP2WorkaroundMiddleware.instance.setRequestAsHTTP2;
		var boundSetRequestAsHTTP2 = oldSetRequestAsHTTP2.bind(expressHTTP2WorkaroundMiddleware.instance);
		expressHTTP2WorkaroundMiddleware.instance.setRequestAsHTTP2 = function(req, res, next){
			boundSetRequestAsHTTP2(req, res, next);
			doneTick();
			// Set original setRequestAsHTTP2
			expressHTTP2WorkaroundMiddleware.instance.setRequestAsHTTP2 = oldSetRequestAsHTTP2;
		};
		// Start request
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				doneTick();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('can have internal setResponseAsHTTP2 method be modified',function(done){
		done = _.once(done);
		var doneTick = _.after(2,done);
		// Modify internal setResponseAsHTTP2
		var oldSetResponseAsHTTP2 = expressHTTP2WorkaroundMiddleware.instance.setResponseAsHTTP2;
		var boundSetResponseAsHTTP2 = oldSetResponseAsHTTP2.bind(expressHTTP2WorkaroundMiddleware.instance);
		expressHTTP2WorkaroundMiddleware.instance.setResponseAsHTTP2 = function(req, res, next){
			boundSetResponseAsHTTP2(req, res, next);
			doneTick();
			// Set original setResponseAsHTTP2
			expressHTTP2WorkaroundMiddleware.instance.setResponseAsHTTP2 = oldSetResponseAsHTTP2;
		};
		// Start request
		var http2Request;
		resDoneHandler = function(err){
			if(err) done("server res.send error: "+err);
		};
		// http2 request
		var http2Request = http2.request({
			host: 'localhost',
			port: httpsPort,
			path: '/',
			timeout: 1000,
			rejectUnauthorized: false
		},function(res){
			var data = null;
			res.setEncoding('utf8');
			res.on('data',function(chunk){
				if(data===null) data = chunk;
				else data = Buffer.concat(data,chunk);
			});
			res.on('end',function(){
				var dataStr = data.toString();
				expect(dataStr).to.equal('HTTP:2.0');
				doneTick();
			});
		});
		http2Request.on('error',function(err){
			done("http2 request error: "+err);
		});
		http2Request.end();
	});
	
	it('should stop server',function(done){
		done = _.once(done);
		if(resDoneHandler) resDoneHandler = null;
		var doneTick = _.after(3,done);
		httpServer.once('close',doneTick);
		http2Server.once('close',doneTick);
		httpServer.close();
		// Close all http2 request endpoints
		for(var key in http2.globalAgent.endpoints){
			var endpoint = http2.globalAgent.endpoints[key];
			endpoint._connection.close('NO_ERROR');
			endpoint.socket.end();
		}
		http2.globalAgent.endpoints = {};
		http2Server.close();
		doneTick();
	});
	
});

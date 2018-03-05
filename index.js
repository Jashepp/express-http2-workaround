"use strict";

/* 
 * GitHub Repository: https://github.com/Jashepp/express-http2-workaround
 * NPM Package: https://www.npmjs.com/package/express-http2-workaround
 * 
 * This returns an express middleware function.
 * If 'app' is passed, the middleware will be automatically applied.
 * This must be done before ANY other middleware that a http2 request will pass to.
 * 
 * Example Use:
 * var expressHTTP2Workaround = require('express-http2-workaround');
 * expressApp.use(expressHTTP2Workaround({ express:express, http2:http2 }));
 * 
 * Or:
 * var expressHTTP2WorkaroundMiddleware = require('express-http2-workaround')({ express:express, http2:http2 });
 * expressApp.use(expressHTTP2WorkaroundMiddleware);
 * // Some methods are available on expressHTTP2WorkaroundMiddleware
 *
 * Or:
 * require('express-http2-workaround')({ express:express, http2:http2, app:expressApp });
 * 
 * See README.md for more information.
 */

var noOp = function(){};

module.exports = function expressHTTP2Workaround_Init(obj){
	var instance = Object.create(instanceProto);
	
	// Arguments Validation
	if(!('express' in obj)) throw new Error('Missing express argument');
	if(!('http2' in obj)) throw new Error('Missing http2 argument');
	if('app' in obj && !('use' in obj.app)) throw new Error('app argument must be an express application');
	var expressApp = ('app' in obj && 'use' in obj.app) ? obj.app : null;
	
	// Check HTTP2
	try{
		var nodeHTTP2Bindings = process.binding('http2');
		if(obj.http2.constants===nodeHTTP2Bindings.constants && 'NGHTTP2_SESSION_SERVER' in nodeHTTP2Bindings.constants) throw new Error('NodeJS experimental HTTP2 implementation not supported by express-http2-workaround');
	}catch(err){};
	
	// HTTP2 Validation
	var http2 = obj.http2;
	if(!('IncomingMessage' in http2)) throw new Error('Missing IncomingMessage property on http2 module?');
	if(!('prototype' in http2.IncomingMessage)) throw new Error('Missing prototype property on http2 IncomingMessage module?');
	if(!('ServerResponse' in http2)) throw new Error('Missing ServerResponse property on http2 module?');
	if(!('prototype' in http2.ServerResponse)) throw new Error('Missing prototype property on http2 ServerResponse module?');
	
	// Express Validation
	var express = obj.express;
	if(!('request' in express)) throw new Error('Missing request property on express module?');
	if(!('response' in express)) throw new Error('Missing response property on express module?');
	
	// Find Express Request Module
	var requestCachedKey = null;
	var requestCachedModule = null;
	for(var k in require.cache){
		if(require.cache[k].exports===express.request){
			requestCachedKey = k;
			requestCachedModule = require.cache[k];
			break;
		}
	}
	if(!requestCachedKey || !requestCachedModule) throw new Error('Failed to find express request module. Express must be required before running this function.');
	
	// Find Express Response Module
	var responseCachedKey = null;
	var responseCachedModule = null;
	for(var k in require.cache){
		if(require.cache[k].exports===express.response){
			responseCachedKey = k;
			responseCachedModule = require.cache[k];
			break;
		}
	}
	if(!responseCachedKey || !responseCachedModule) throw new Error('Failed to find express response module. Express must be required before running this function.');
	
	// Require a new instance of Express Request Module
	delete require.cache[requestCachedKey]; // Temporary remove from cache
	instance.requestHTTP2 = require(requestCachedModule.filename);
	require.cache[requestCachedKey] = requestCachedModule; // Restore original into cache
	
	// Require a new instance of Express Response Module
	delete require.cache[responseCachedKey]; // Temporary remove from cache
	instance.responseHTTP2 = require(responseCachedModule.filename);
	require.cache[responseCachedKey] = responseCachedModule; // Restore original into cache
	
	// Set the new request and response modules to have the http2 prototypes
	Object.setPrototypeOf(instance.requestHTTP2,http2.IncomingMessage.prototype);
	Object.setPrototypeOf(instance.responseHTTP2,http2.ServerResponse.prototype);
	
	// Set instance properties
	instance.http2 = http2;
	instance.express = express;
	instance._setRequestAsHTTP2DefinePropertyObj = {
		get: (function(instance){ return function requestHTTP2_Get(){ return instance.requestHTTP2; }; })(instance),
		set: noOp,
		enumerable: true,
		configurable: true
	};
	instance._setResponseAsHTTP2DefinePropertyObj = {
		get: (function(instance){ return function responseHTTP2_Get(){ return instance.responseHTTP2; }; })(instance),
		set: noOp,
		enumerable: true,
		configurable: true
	};
	
	// Wrap middleware and set it's [[Prototype]] to instance
	var wrappedMiddleware = (function(instance){
		return function expressHTTP2Workaround_MiddlewareWrapper(req, res, next){
			return instance.middleware(req, res, next);
		};
	})(instance);
	wrappedMiddleware.instance = instance;
	Object.setPrototypeOf(wrappedMiddleware,instance);
	// To override any method, simply do wrappedMiddleware.instance.theMethod = yourOwnFunction;
	
	// If 'app' argument, apply middleware
	if(expressApp) expressApp.use(wrappedMiddleware);
	
	// Finish
	return wrappedMiddleware;
};

var instanceProto = Object.create(module.exports);
instanceProto.middleware = function expressHTTP2Workaround_Middleware(req, res, next){
	if(req.httpVersionMajor===2){
		this.setRequestAsHTTP2(req);
		this.setResponseAsHTTP2(res);
	}
	next();
};
instanceProto.setRequestAsHTTP2 = function expressHTTP2Workaround_setRequestAsHTTP2(req){
	var expressApp = req.app;
	Object.setPrototypeOf(req,this.requestHTTP2);
	// Express sets the __proto__ directly, so we need to stop that from happening, without causing express to error on TypeError
	Object.defineProperty(req,'__proto__',this._setRequestAsHTTP2DefinePropertyObj);
	req.app = expressApp;
};
instanceProto.setResponseAsHTTP2 = function expressHTTP2Workaround_setResponseAsHTTP2(res){
	var expressApp = res.app;
	Object.setPrototypeOf(res,this.responseHTTP2);
	// Express sets the __proto__ directly, so we need to stop that from happening, without causing express to error on TypeError
	Object.defineProperty(res,'__proto__',this._setResponseAsHTTP2DefinePropertyObj);
	res.app = expressApp;
};

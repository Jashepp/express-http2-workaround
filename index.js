"use strict";

/* 
 * GitHub Repository: https://github.com/Unchosen/express-http2-workaround
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
 * require('express-http2-workaround')({ express:express, http2:http2, app:expressApp });
 * 
 * See README.md for more information.
 */

var me = module.exports = function(obj){
	
	// Arguments Validation
	if(!('express' in obj)) throw new Error('Missing express argument');
	if(!('http2' in obj)) throw new Error('Missing http2 argument');
	if('app' in obj && !('use' in obj.app)) throw new Error('app argument must be an express application');
	var expressApp = ('app' in obj && 'use' in obj.app) ? obj.app : null;
	
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
	me.requestHTTP2 = require(requestCachedModule.filename);
	require.cache[requestCachedKey] = requestCachedModule; // Restore original into cache
	
	// Require a new instance of Express Response Module
	delete require.cache[responseCachedKey]; // Temporary remove from cache
	me.responseHTTP2 = require(responseCachedModule.filename);
	require.cache[responseCachedKey] = responseCachedModule; // Restore original into cache
	
	// Set the new request and response modules to have the http2 prototypes
	me.requestHTTP2.__proto__ = http2.IncomingMessage.prototype;
	me.responseHTTP2.__proto__ = http2.ServerResponse.prototype;
	
	// If 'app' argument, apply middleware
	if(expressApp) expressApp.use(me.middlewareFunc);
	
	// Finish
	return me.middlewareFunc;
};

me.noOp = function(){};

// These post-run methods are available to use

me.middlewareFunc = function expressHTTP2WorkaroundMiddleware(req, res, next){
	if(req.httpVersionMajor===2){
		me.setRequestAsHTTP2(req);
		me.setResponseAsHTTP2(res);
	}
	next();
};

// Methods to update request and response prototypes with HTTP2 prototypes
// No argument validation, we want to keep it fast and simple

// I am using Object.defineProperty because express/lib/application.js:230 overwrites the .__proto__ property for request and response on sub express applications
// To ignore the overwrite, I am setting the property as configurable: true, but set() as noOp
// This is quite risky, but any other way is even more dangerous

me.setRequestAsHTTP2 = function(req){
	var expressApp = req.app;
	req.__proto__ = me.requestHTTP2;
	Object.defineProperty(req,'__proto__',me.setRequestAsHTTP2.definePropertyObj);
	req.app = expressApp;
};
me.setRequestAsHTTP2.get = function(){
	return me.requestHTTP2;
};
me.setRequestAsHTTP2.definePropertyObj = {
	get: me.setRequestAsHTTP2.get,
	set: me.noOp,
	enumerable: true,
	configurable: true
};

me.setResponseAsHTTP2 = function(res){
	var expressApp = res.app;
	res.__proto__ = me.responseHTTP2;
	Object.defineProperty(res,'__proto__',me.setResponseAsHTTP2.definePropertyObj);
	res.app = expressApp;
};
me.setResponseAsHTTP2.get = function(){
	return me.responseHTTP2;
};
me.setResponseAsHTTP2.definePropertyObj = {
	get: me.setResponseAsHTTP2.get,
	set: me.noOp,
	enumerable: true,
	configurable: true
};

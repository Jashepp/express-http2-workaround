"use strict";

/* 
 * This returns an Express Middleware Function.
 * If 'app' is passed, the middleware will be automatically applied.
 * This must be done before ANY other middleware that a http2 request will pass to.
 * 
 * Example Use:
 * var expressHTTP2Workaround = require('express-http2-workaround');
 * expressApp.use(expressHTTP2Workaround({ express:express, http2:http2 }));
 *
 * Or:
 * require('express-http2-workaround')({ express:express, http2:http2, app:expressApp });
 */

module.exports = function(obj){
	
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
	var newRequest = require(requestCachedModule.filename);
	require.cache[requestCachedKey] = requestCachedModule; // Restore original into cache
	
	// Require a new instance of Express Response Module
	delete require.cache[responseCachedKey]; // Temporary remove from cache
	var newResponse = require(responseCachedModule.filename);
	require.cache[responseCachedKey] = responseCachedModule; // Restore original into cache
	
	// Set the new request and response modules to have the http2 prototypes
	newRequest.__proto__ = http2.IncomingMessage.prototype;
	newResponse.__proto__ = http2.ServerResponse.prototype;
	
	// Debug purposes
	express.request_http2 = newRequest;
	express.response_http2 = newResponse;
	
	// Create middleware function
	var middlewareFunc = function(req, res, next){
		if(req.httpVersionMajor===2){
			var reqApp = req.app;
			var resApp = res.app;
			req.__proto__ = newRequest;
			res.__proto__ = newResponse;
			req.app = reqApp;
			res.app = resApp;
		}
		next();
	};
	
	// If 'app' argument, apply middleware
	if(expressApp){
		expressApp.use(middlewareFunc);
	}
	
	// Finish
	return middlewareFunc;
};

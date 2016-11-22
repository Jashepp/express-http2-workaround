# express-http2-workaround - Nodejs Module
> Let HTTP2 work with express

[![NPM Version][npm-image]][npm-url]
[![Downloads Stats][npm-downloads]][npm-url]

Compatibility for the [express](https://www.npmjs.com/package/express) module to work with the [http2](https://www.npmjs.com/package/http2) module

## What is this?

The awesome [http2](https://www.npmjs.com/package/http2) nodejs module (https://github.com/molnarg/node-http2) does not work straight out the box with the awesome [express](https://www.npmjs.com/package/express) module (https://github.com/expressjs/express).

Due to express having the request and response objects prototype the inbuilt nodejs http  IncomingMessage and ServerResponse objects, all requests served by express that are initialised by something else, such as http2, cause an error.

This issue is mentioned in many places:
https://github.com/expressjs/express/issues/2364 (thread closed)
https://github.com/molnarg/node-http2/issues/220 (on the right track for a solution)
https://github.com/molnarg/node-http2/issues/100 (thread closed)

This module creates new express request and response objects, then sets their prototype to http2 IncomingMessage and ServerResponse objects.
The middleware returned by this module simply checks if the connection is http2 and sets the request and response prototypes to the newly created ones which have the http2 prototype.

## Why use this?

At the moment, if someone wants to create an express application that has HTTP/2, while also serving HTTP/1.x, the closest thing you can use is the [spdy](https://www.npmjs.com/package/spdy) module which works well with [express](https://www.npmjs.com/package/express).

With this module, you can use HTTP/2 via the [http2](https://www.npmjs.com/package/http2) module with [express](https://www.npmjs.com/package/express).

## Installation

Install the module via [NPM](https://www.npmjs.com/package/express-http2-workaround)
```
npm install express-http2-workaround --save
```
Or [download the latest release](https://github.com/Unchosen/express-http2-workaround/releases), or git clone the [repository on GitHub](https://github.com/Unchosen/express-http2-workaround).


### How to use

When required, a function is available to call with an object as the argument that must contain the express module and the http2 module. If you want the express middleware to be automatically attached to the express application, simply pass the application as 'app' (see Method 1 below).

Method 1:
```javascript
require('express-http2-workaround')({ express:express, http2:http2, app:expressApp });
```

Method 2:
```javascript
var expressHTTP2Workaround = require('express-http2-workaround');
expressApp.use(expressHTTP2Workaround({ express:express, http2:http2 }));
```

It is best to have this middleware added to your express application before any other middleware. Otherwise the known express+http2 issue may occur in previous middlewares for HTTP/2 requests.

This must be done for all sub express applications too (experimental).
```javascript
// let 'expressApp' be an existing express application
var subApp = express();
require('express-http2-workaround')({ express:express, http2:http2, app:subApp });
expressApp.use(subApp);
```

## Example

```javascript
// Require Modules
var fs = require('fs');
var express = require('express');
var http = require('http');
var http2 = require('http2');

// Create Express Application
var app = express();

// Make HTTP2 work with Express (this must be before any other middleware)
require('express-http2-workaround')({ express:express, http2:http2, app:app });

// Setup HTTP/1.x Server
var httpServer = http.Server(app);
httpServer.listen(80,function(){
  console.log("Express HTTP/1 server started");
});

// Setup HTTP/2 Server
var httpsOptions = {
    'key' : fs.readFileSync(__dirname + '/keys/ssl.key'),
    'cert' : fs.readFileSync(__dirname + '/keys/ssl.crt'),
    'ca' : fs.readFileSync(__dirname + '/keys/ssl.crt')
};
var http2Server = http2.createServer(httpsOptions,app);
http2Server.listen(443,function(){
  console.log("Express HTTP/2 server started");
});

// Serve some content
app.get('/', function(req,res){
    res.send('Hello World! Via HTTP '+req.httpVersion);
});
```

## Known Issues

Any application that needs to access a http IncomingMessage or ServerResponse prototype method which does not exist in http2, may error (I have not come across this issue yet).

## Tests

None. Try existing express applications with http2 and this module.

## Contributors

Create issues on the Github project or create pull requests.

All the help is appreciated.

## License

MIT License

Copyright (c) 2016 Jason Sheppard

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Links

Github Repository: [https://github.com/Unchosen/express-http2-workaround](https://github.com/Unchosen/express-http2-workaround)

NPM Package: [https://www.npmjs.com/package/express-http2-workaround](https://www.npmjs.com/package/express-http2-workaround)

[npm-image]: https://img.shields.io/npm/v/express-http2-workaround.svg?style=flat-square
[npm-url]: https://npmjs.org/package/express-http2-workaround
[npm-downloads]: https://img.shields.io/npm/dm/express-http2-workaround.svg?style=flat-square

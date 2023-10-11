const http = require('http');

http.createServer((req, res) => {

	console.log("req");
	//console.log(req);
	console.log(req.rawHeaders);

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Hello there');
    res.end();

}).listen(8080);

console.log('server running on port 8080');

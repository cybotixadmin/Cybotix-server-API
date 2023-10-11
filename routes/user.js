
const { parse } = require('querystring');
const { generateKeyPair } = require('crypto');

// Including generateKeyPairSync from crypto module
const { generateKeyPairSync } = require('crypto');

module.exports = {

/*
 * GET create key page
 */

create_key: (req, res) => {
//exports.create_key = function(req, res){
	console.log("create new key");
																																																																																																																																																																																																																																																																																																																																																																																																																																																											
	
	// create a public private key pair
	
	// Including publicKey and  privateKey from 
// generateKeyPairSync() method with its 
// parameters
const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'secp256k1',    // Options
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});
  
// Prints asymmetric key pair
console.log("The public key is: ", publicKey);
console.log();
console.log("The private key is: ", privateKey);
	
	
	
	// put the key in the database 
	
	
	
	
	
  res.render('create_key', {});


},


/*
 * GET admin page.
 */

admin: (req, res) => {
//exports.admin = function(req, res, next) {
	console.log("admin page");
	console.log("request 2");
	//console.log(req);
	//console.log("<request");
	
	
	  let list = [
      {name: 'PHP'},
      {name: 'Ruby'},
      {name: 'Java'},
      {name: 'Python'},
      {name: 'dotNet'},
      {name: 'C#'},
      {name: 'Swift'},
      {name: 'Pascal'},
  ]

  res.render('admin', { title: 'Demo Ejs', list: list });
	
//  res.render('admin');

},


/*
 * GET root page
 */
frontpage: (req, res) => {

//exports.frontpage = function(req, res){
	console.log("render front page");
  res.render('frontpage', {});


}

}

/*
 * POST submit
 */

exports.submit = function(req, res){
	console.log("submit action");
	console.log(req.method);
	
	  if (req.method === 'POST') {
	console.log("parse content");
	   let body = '';

 //   req.on('data', chunk => {
 //       body += chunk.toString();
 //   });

req.on('data', (data) => {
		body += data;
	});

    req.on('end', () => {
        console.log(parse(body));
console.log("three");
//res.redirect('localhost:3000');
//res.writeHead(200, {'Content-Type' : 'text/html'});

		//res.write(body, () => {
		//	res.end();
		//});

// ok, got it. Now show the front page again
// res.render('frontpage');

//
//response.writeHead(302, {
//  'Location': 'your/404/path.html'
  //add other headers here...
//});
//response.end();

        //res.end('ok');
    });
		
        // Handle post info...
    }
    else {
	console.log("two");
      res.end(`
        <!doctype html>
        <html>
        <body>
            <form action="/" method="post">
                <input type="text" name="fname" /><br />
                <input type="number" name="age" /><br />
                <input type="file" name="photo" /><br />
                <button>Save</button>
            </form>
        </body>
        </html>
      `);
    }
	
	
  res.render('frontpage');

};



/*
 * GET users listing.
 */

exports.list = function(req, res){
  res.send("respond with a resource..");
};


/*
 * GET login page.
 */

exports.login = function(req, res, next) {
  res.render('login');
};


/*
 * GET logout route.
 */

exports.logout = function(req, res, next) {
  req.session.destroy();
  res.redirect('/');
};


/*
 * POST authenticate route.
 */

exports.authenticate = function(req, res, next) {
  if (!req.body.email || !req.body.password)
    return res.render('login', {error: "Please enter your email and password."});
  req.collections.users.findOne({
    email: req.body.email,
    password: req.body.password
  }, function(error, user){
    if (error) return next(error);
    if (!user) return res.render('login', {error: "Incorrect email&password combination."});
    req.session.user = user;
    req.session.admin = user.admin;
    res.redirect('/admin');
  })
};

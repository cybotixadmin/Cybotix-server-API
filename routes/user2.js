
const { parse } = require('querystring');


/*
 * GET admin page.
 */

exports.admin2 = function(req, res, next) {
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

};
/*
 * GET users listing.
 */

exports.list = function(req, res){
  res.send("respond with a resource");
};


/*
 * GET root
 */

exports.frontpage = function(req, res){
	console.log("frontpage");
  res.send("respond with a resource");
};
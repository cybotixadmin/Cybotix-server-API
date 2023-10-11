exports.about = function(req, res){
	// documentation at http://expressjs.com/api.html#res.render
	
res.render('about', { title: 'Express' });
};
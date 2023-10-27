module.exports = {
  apps : [{
    name   : "apiapp",
    script : "./app.js",
	watch: ["server", "client"],
    // Delay between restart
    watch_delay: 1000,
    ignore_watch : ["node_modules","public","Dockerfile"],
    watch_options: {
      "followSymlinks": false
    }
  }]
}


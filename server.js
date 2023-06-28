// This script is only used on Heroku; for gh-pages we host /deploy directly

const path = import('path');
const compression = import('compression');
const express = import('express');
const app = express();
const port = process.env.PORT || 8383;
const ip = process.env.IP || null; // Use specified IP to bind to otherwise, bind to default for the API

// Enable gzip compression
app.use(compression());

// Assets are hashed so they can be in the cache for longer
app.use(
	'/assets/',
	express.static(path.join(__dirname, 'deploy', 'assets'), {
		maxAge: '1d',
	}),
);
app.use(express.static(path.join(__dirname, 'deploy')));

// Listen for server, and use static routing for deploy directory
app.listen(port, ip, () => {
	console.log(
		`Server listening at port ${port}.\nOpen http://localhost:${port} in Chrome/Chromium.`,
	);
});

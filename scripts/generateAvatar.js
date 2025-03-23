// AUTO-GENERATED FILE — DO NOT EDIT
// Use `node scripts/generateAvatar.js` to regenerate

const fs = require('fs');
const path = require('path');

const AVATAR_DIR = path.join(__dirname, '../assets/units/avatars');
const OUTPUT_FILE = path.join(__dirname, '../src/style/avatars.less');

// Helper: turn "Dark Angel.jpg" into "avatar-dark-angel"
function toClassName(filename) {
	return (
		'avatar-' +
		filename
			.replace(/\.[^/.]+$/, '') // remove extension
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-') // replace non-alphanumerics with -
			.replace(/^-+|-+$/g, '')
	);
}

function generate() {
	const files = fs.readdirSync(AVATAR_DIR).filter((file) => /\.(jpg|jpeg|png)$/i.test(file));

	const lines = files.map((file) => {
		const className = toClassName(file);
		const relativePath = `/assets/units/avatars/${file}`;
		return `.${className}[set="default"] {\n  background-image: url('${relativePath}');\n}`;
	});

	fs.writeFileSync(OUTPUT_FILE, lines.join('\n\n'), 'utf8');
	console.log(`✅ avatars.less generated with ${files.length} avatars.`);
}

generate();

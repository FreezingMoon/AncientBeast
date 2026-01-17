const fs = require('fs');
const path = require('path');

const avatarsDir = './src/assets/units/avatars'; 
const outputFilePath = './src/avatars.json';

fs.readdir(avatarsDir, (err, files) => {
  if (err) throw err;

  const avatars = {};
  files.forEach(file => {
    const type = path.basename(file, path.extname(file));
    avatars[`type${type}`] = `${avatarsDir}/${file}`;
  });

  fs.writeFileSync(outputFilePath, JSON.stringify(avatars, null, 2));
  console.log(`Avatar configuration saved to ${outputFilePath}`);
});

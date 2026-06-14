const { imagesToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const pngBuffer = fs.readFileSync(path.join(__dirname, 'eliva_logo.png'));

imagesToIco([pngBuffer])
  .then(buf => {
    fs.writeFileSync(path.join(__dirname, 'eliva_logo.ico'), buf);
    console.log('eliva_logo.ico created successfully');
  })
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });

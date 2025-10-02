const fs = require('fs');
const path = require('path');

try {
  const pkgPath = path.join(__dirname, '..', 'node_modules', '@adminjs', 'design-system', 'package.json');
  if (!fs.existsSync(pkgPath)) {
    process.exit(0);
  }
  const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (
    json &&
    json.exports &&
    json.exports['./styled-components'] &&
    !json.exports['./styled-components'].require
  ) {
    json.exports['./styled-components'].require = './build/utils/styled.js';
    fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2));
    console.log('Patched @adminjs/design-system exports for ./styled-components (added require)');
  }
} catch (e) {
  console.error('Failed to patch @adminjs/design-system package.json:', e);
  process.exit(0);
}



const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'index.html');
const ogTags = `
    <meta property="og:title" content="Future Selves" />
    <meta property="og:description" content="Every week, AI distills your reflections into a resonant summary and 2-3 concrete action items for the week ahead." />
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
`;

let html = fs.readFileSync(distPath, 'utf8');

// Insert OG tags before the closing </head> tag
if (!html.includes('og:title')) {
  html = html.replace('</head>', `${ogTags}\n  </head>`);
  fs.writeFileSync(distPath, html);
  console.log('✅ OG meta tags injected into index.html');
} else {
  console.log('ℹ️  OG meta tags already present');
}

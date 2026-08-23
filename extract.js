const fs = require('fs');

const content = fs.readFileSync('script.js', 'utf8');
const match = content.match(/const movies = (\[[\s\S]*?\]);\s*\/\//);
// Actually, it ends at "];\n\n// DOM Elements"
const match2 = content.match(/const movies = (\[[\s\S]*?\]);\s*\/\/\s*DOM Elements/);

if (match2) {
    // We need to evaluate this JS array. It's safe since it's just our data.
    const arrayStr = match2[1];
    let moviesArray;
    eval(`moviesArray = ${arrayStr}`);
    
    fs.writeFileSync('data.json', JSON.stringify(moviesArray, null, 4));
    console.log('Successfully extracted ' + moviesArray.length + ' movies to data.json');
} else {
    console.error('Could not match the movies array');
}

const fs = require('fs');

async function runQuery(filename) {
  console.log(`Running ${filename}...`);
  const query = fs.readFileSync(filename, 'utf8');
  
  const res = await fetch("https://api.supabase.com/v1/projects/ljhzwglkbaipwbmkpnmd/database/query", {
    method: "POST",
    headers: {
      "Authorization": "Bearer sbp_67739d3837aec6bbe152c1a6c9a111831a5902c5",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  
  const text = await res.text();
  if (!res.ok) {
    console.error(`Error in ${filename}:`, res.status, text);
    throw new Error("API failed");
  } else {
    console.log(`Success for ${filename}. Length of output: ${text.length}`);
  }
}

async function main() {
  try {
    await runQuery('part1.sql');
    await runQuery('part2.sql');
    await runQuery('part3.sql');
    console.log("All done!");
  } catch (err) {
    console.error(err);
  }
}

main();

const fs = require('fs');
const readline = require('readline');

async function main() {
  const filePath = 'C:\\Users\\Reda Tech\\.gemini\\antigravity-ide\\brain\\d8379c51-d052-41b8-9b97-a805de7102f5\\.system_generated\\logs\\transcript.jsonl';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    try {
      const obj = JSON.parse(line);
      const content = JSON.stringify(obj);
      if (content.includes('get_agents_overview') && (content.includes('CREATE') || content.includes('function') || content.includes('FUNCTION'))) {
        console.log(`Line ${lineNum}: Type: ${obj.type}, Source: ${obj.source}`);
        console.log('Content snippet:', content.substring(0, 500));
        console.log('================================================================================');
      }
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);

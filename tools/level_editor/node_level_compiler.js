// BinarySaver — Save the level as a binary file and write it to a binary file
// Node.js supported (fs.writeFileSync)
const fs = require('fs');

class BitStream {
  constructor() {
    this.bits = '';
    this.position = 0;
  }
  write(bits) {
    this.bits += bits;
    this.position += bits.length;
  }
  seek(index) {
    if (index < 0 || index > this.position) {
      throw new Error(`Index ${index} out of range (0 - ${this.position})`);
    }
    this.position = index;
  }
  seekToEnd() {
    this.position = this.bits.length;
  }
  getLength() {
    return this.bits.length;
  }
}

// Combine multiple BitStream instances into a single BitStream
function combineBitStreams(streams) {
  const out = new BitStream();
  for (const st of streams) {
    out.write(st.bits);
  }
  return out;
}

/**
 * Convert a binary string to a Uint8Array byte array
 * @param {string} binaryStr - A string containing only 0s and 1s (e.g. "101010110011")
 * @returns {Uint8Array} The converted byte array
 */
function binaryStringToUint8Array(binaryStr) {
  // Validate input: ensure only 0s and 1s
  console.log('binaryStr:', binaryStr);
  if (!/^[01]+$/.test(binaryStr)) {
    throw new Error("Input string must contain only 0s and 1s");
  }

  // Pad the string to a multiple of 8 bits (append 0s if necessary)
  const paddingLength = (8 - (binaryStr.length % 8)) % 8;
  const paddedStr = binaryStr.padEnd(binaryStr.length + paddingLength, '0');

  const bytes = [];
  // Split the string into 8-bit chunks and convert each to a byte
  for (let i = 0; i < paddedStr.length; i += 8) {
    const byteStr = paddedStr.slice(i, i + 8);
    // Convert binary string to decimal number (base 2)
    const byte = parseInt(byteStr, 2);
    bytes.push(byte);
  }

  return new Uint8Array(bytes);
}
// Save a Uint8Array to a binary file (Node.js environment)
function saveUint8ArrayToFile(uint8Array, filename) {
    // Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
            const fs = require('fs');
            fs.writeFileSync(filename, uint8Array);
            console.log(`成功保存 ${filename}，大小 ${uint8Array.length} 字节`);
        } catch (e) {
            console.error(`保存 ${filename} 失败:`, e);
        }
    } else {
        console.error('当前环境不是 Node.js，无法保存文件');
    }
}


/*
//example:

:map base empty
solid 1 12 31 14
empty 3 12 5 14

:object
blackhole bh1 1 1
blackhole bh2 2 2
floatrect fb1 3 4 6 6

:script
move ws1 2 3 5
move ws2 4 4 1
wait player-in-area 10 10 4 2
move fb1 5 4

:end
*/
const objectTypes = {
    'blackhole': '0000',
    'floatrect': '0001',
    'button': '0010',
    'bounce': '0011',
    'destination': '0100',
    'oneway': '0101',
}
function translateFromScriptToBin(script, output) {
    // Parse the script to extract map, object, and script sections
    const sections = parseLevelSections(script);
    if (!sections) {
        console.error('Failed to parse level sections');
        return;
    }

    // Compile each section into a BitStream
    const mapBitStream = compileMapSection(sections.map);
    const objectBitStream = compileObjectSection(sections.object);
    const scriptBitStream = compileScriptSection(sections.script, sections.objectMappings);

    // Combine all parts into a single BitStream and save to binary file
    try {
        const combined = combineBitStreams([mapBitStream, objectBitStream, scriptBitStream]);
        console.log('Combined bitstream total bits:', combined.getLength(), 'total bytes:', Math.ceil(combined.getLength()/8));
        const fileUint8Array = binaryStringToUint8Array(combined.bits);
        saveUint8ArrayToFile(fileUint8Array, output);
    } catch (e) {
        console.error('Failed to combine/save bitstreams:', e);
    }
}

// Parse the script to extract map, object, and script sections
function parseLevelSections(script) {
    const lines = script.split('\n')
        .filter(line => line.trim().length > 0)
        .filter(line => !line.trim().startsWith('//'));

    const sections = { map: [], object: [], script: [] };
    const objectMappings = {};
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith(':')) {
            const sectionName = trimmed.slice(1).toLowerCase();
            if (sectionName === 'end') break;
            if (sections.hasOwnProperty(sectionName)) {
                currentSection = sectionName;
            }
            continue;
        }

        if (currentSection) {
            sections[currentSection].push(trimmed);
        }
    }

    // Build object mappings table
    for (let i = 0; i < sections.object.length; i++) {
        const parts = sections.object[i].split(' ');
        if (parts.length >= 2) {
            objectMappings[parts[1]] = i.toString(2).padStart(6, '0');
        }
    }

    return { ...sections, objectMappings };
}

function compileMapSection(mapCommands) {
    console.log('map part:');
    
    if (mapCommands.length === 0) {
        return new BitStream();
    }

    // Step 1: Find the base command and count the number of commands
    const baseCommand = mapCommands.find(cmd => cmd.startsWith('base'));
    if (!baseCommand) {
        console.error('No base command found in map section');
        return new BitStream();
    }

    const base = baseCommand.split(' ')[1];
    const commandCount = mapCommands.length - 1;
    
    if (commandCount >= 128) {
        console.error('Length of map commands are too big (num/127)'.replace('num', commandCount));
    }

    const bitStream = new BitStream();
    
    // Write base type and command count
    bitStream.write(base === 'solid' ? '1' : '0');
    bitStream.write(commandCount.toString(2).padStart(7, '0'));
    console.log(base === 'solid' ? '1' : '0', commandCount.toString(2).padStart(7, '0'));

    // Process each map command
    for (const command of mapCommands) {
        if (command.startsWith('base')) continue;
        
        const parts = command.split(' ');
        const type = parts[0] === 'solid' ? '1' : '0';
        
        const positions = parts.slice(1).map(Number);
        const binaryCommand = type + 
            positions[0].toString(2).padStart(5, '0') +
            positions[1].toString(2).padStart(4, '0') +
            positions[2].toString(2).padStart(5, '0') +
            positions[3].toString(2).padStart(4, '0');
        
        console.log(command, '\t', binaryCommand);
        bitStream.write(binaryCommand);
    }

    return bitStream;
}

function compileObjectSection(objectCommands) {
    console.log('object part:');
    
    const bitStream = new BitStream();

    // Write object count
    bitStream.write(objectCommands.length.toString(2).padStart(7, '0'));

    // Process each object
    for (const command of objectCommands) {
        const parts = command.split(' ');
        const type = parts[0];
        const id = parts[1];
        
        const typeBin = objectTypes[type];
        if (!typeBin) {
            console.error('Unknown object type:', type);
            continue;
        }

        // 提取标志位（只认以 - 开头的单词）
        const hasHidden = parts.includes('-hidden');
        const hasNoCollision = parts.includes('-no-collision');

        // 过滤出纯数值参数（去掉类型名、ID、标志位）
        const numericParts = parts.filter(p => !p.startsWith('-') && p !== type && p !== id);

        const objectIndex = objectCommands.indexOf(command).toString(2).padStart(6, '0');
        const x = parseInt(numericParts[0]).toString(2).padStart(5, '0');
        const y = parseInt(numericParts[1]).toString(2).padStart(4, '0');

        bitStream.write(typeBin);
        bitStream.write(objectIndex);
        bitStream.write(x);
        bitStream.write(y);

        // 写入类型专属数据
        if (type === 'floatrect') {
            let fw = parseInt(numericParts[2] || 1);
            let fh = parseInt(numericParts[3] || 1);
            if (fw > 63) { console.warn(`  Warning: floatrect width ${fw} exceeds 6-bit max (63), clamping to 63`); fw = 63; }
            if (fh > 15) { console.warn(`  Warning: floatrect height ${fh} exceeds 4-bit max (15), clamping to 15`); fh = 15; }
            const width = fw.toString(2).padStart(6, '0');
            const height = fh.toString(2).padStart(4, '0');
            bitStream.write(width);
            bitStream.write(height);
        } else if (type === 'oneway') {
            let ow = parseInt(numericParts[2] || 1);
            if (ow > 63) { console.warn(`  Warning: oneway width ${ow} exceeds 6-bit max (63), clamping to 63`); ow = 63; }
            const width = ow.toString(2).padStart(6, '0');
            bitStream.write(width);
        }
        // 所有类型末尾统一写入 hidden(1) + noCollision(1)
        bitStream.write(hasHidden ? '1' : '0');
        bitStream.write(hasNoCollision ? '1' : '0');
        const extraInfo = type === 'floatrect' ? ` ${numericParts[2]} ${numericParts[3]}` : (type === 'oneway' ? ` ${numericParts[2]}` : '');
        console.log(`  ${type} ${id}: ${typeBin} ${objectIndex} ${x} ${y}${extraInfo} hidden=${hasHidden} noCollision=${hasNoCollision}`);
    }

    return bitStream;
}

function compileScriptSection(scriptCommands, objectMappings) {
    console.log('script part:');
    
    const bitStream = new BitStream(); // Predict size
    let instructionCount = 0;

    for (const command of scriptCommands) {
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === 'move') {
            // move <id> <x> <y> <duration> [-block]
            const objId = parts[1];
            const objIndex = objectMappings[objId] || '000000';
            // x and y now support half-step precision
            // x: 6 bits -> 5 bits integer (0..31) + 1 bit half-step
            // y: 5 bits -> 4 bits integer (0..15) + 1 bit half-step
            let xVal = parseFloat(parts[2] || 0);
            if (isNaN(xVal)) xVal = 0;
            let xInt = Math.floor(xVal);
            let xHalf = (xVal - xInt) >= 0.5 ? 1 : 0;
            if (xInt > 31) { console.warn('X too large, clamping to 31.5'); xInt = 31; xHalf = 1; }
            const xBits = xInt.toString(2).padStart(5, '0') + (xHalf ? '1' : '0');

            let yVal = parseFloat(parts[3] || 0);
            if (isNaN(yVal)) yVal = 0;
            let yInt = Math.floor(yVal);
            let yHalf = (yVal - yInt) >= 0.5 ? 1 : 0;
            if (yInt > 15) { console.warn('Y too large, clamping to 15.5'); yInt = 15; yHalf = 1; }
            const yBits = yInt.toString(2).padStart(4, '0') + (yHalf ? '1' : '0');

            // duration: support quarter-step precision (units of 0.25)
            // parse as float, encode into 6 bits: first 4 bits = integer part (0..15), last 2 bits = quarter-step flag
            let durationVal = parseFloat(parts[4] || 0);
            if (isNaN(durationVal)) durationVal = 0;
            let intPart = Math.floor(durationVal);
            let quarterPart = Math.round((durationVal - intPart) * 4);
            if (quarterPart > 3) {
                quarterPart = 3;
            }
            if (intPart > 15) {
                console.warn('Duration too large, clamping to 15.75');
                intPart = 15;
                quarterPart = 3;
            }
            const durationBits = intPart.toString(2).padStart(4, '0') + quarterPart.toString(2).padStart(2, '0');

            // New: block flag indicates script should block until movement completes
            let blockFlag = '0';
            if (parts.indexOf('-block') !== -1) blockFlag = '1';

            bitStream.write('1'); // move instruction identifier
            bitStream.write(objIndex);
            bitStream.write(xBits);
            bitStream.write(yBits);
            bitStream.write(durationBits);
            bitStream.write(blockFlag);

            console.log(`  move ${objId}:\t1${objIndex}${xBits}${yBits}${durationBits}${blockFlag} (x=${xVal}, y=${yVal}, duration=${durationVal})`);
            instructionCount++;

        } else if (cmd === 'wait') {
            // wait <event> ...
            const event = parts[1];
            let eventType = '00';
            let params = '';

            switch (event) {
                case 'player-in-area':
                    eventType = '00';
                    const x1 = parseInt(parts[2]).toString(2).padStart(5, '0');
                    const y1 = parseInt(parts[3]).toString(2).padStart(4, '0');
                    let w = parseInt(parts[4] || 1);
                    let h = parseInt(parts[5] || 1);
                    if (w < 1) { console.warn('Width too small, clamping to 1'); w = 1; }
                    if (w > 7) { console.warn('Width too large, clamping to 7'); w = 7; }
                    if (h < 1) { console.warn('Height too small, clamping to 1'); h = 1; }
                    if (h > 7) { console.warn('Height too large, clamping to 7'); h = 7; }
                    const width = w.toString(2).padStart(3, '0');
                    const height = h.toString(2).padStart(3, '0');
                    params = x1 + y1 + width + height;
                    break;
                    
                case 'button-press':
                    eventType = '01';
                    const buttonObjId = parts[2];
                    params = objectMappings[buttonObjId] || '000000';
                    break;
                    
                case 'for-seconds':
                    eventType = '10';
                    // 半步精度：前5位整数0~31，末位0.5标志
                    let secVal = parseFloat(parts[2] || 0);
                    if (isNaN(secVal)) secVal = 0;
                    let secInt = Math.floor(secVal);
                    let secHalf = (secVal - secInt) >= 0.5 ? 1 : 0;
                    if (secInt > 31) { console.warn('Seconds too large, clamping to 31.5'); secInt = 31; secHalf = 1; }
                    const secondsBits = secInt.toString(2).padStart(5, '0') + (secHalf ? '1' : '0');
                    params = secondsBits;
                    break;
                    
                default:
                    console.error('Unknown wait event:', event);
                    continue;
            }

            bitStream.write('0'); // wait instruction identifier
            bitStream.write(eventType);
            bitStream.write(params);

            console.log(`  wait ${event}:\t0${eventType}${params}`);
            instructionCount++;
        }
    }

    // Insert instruction count at the beginning
    const instructionCountBin = instructionCount.toString(2).padStart(7, '0');
    const finalBitStream = new BitStream();
    finalBitStream.write(instructionCountBin);
    finalBitStream.write(bitStream.bits);

    console.log('script header/count:', instructionCountBin, 'total bits:', finalBitStream.getLength());
    return finalBitStream;
}

function readLocalSourceFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return data;
    } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);
        return null;
    }
}

// ==================== 编译所有关卡（根据存在的文件自动判断） ====================
function getAvailableLevels() {
    const files = fs.readdirSync('level_sources');
    return files
        .filter(f => f.endsWith('.txt'))
        .map(f => f.replace(/\.txt$/, ''));
}
const allLevels = getAvailableLevels();
for (const lvl of allLevels) {
    translateFromScriptToBin(
        readLocalSourceFile(`level_sources/${lvl}.txt`),
        `../../src/assets/lvl/${lvl}.bin`
    );
}

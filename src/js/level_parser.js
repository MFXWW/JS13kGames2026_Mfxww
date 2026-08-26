// ==================== BinaryReader 相关全局变量（前缀 BR_） ====================
let BR_data = null;
let BR_byteOffset = 0;
let BR_bitOffset = 0;

// ==================== BinaryReader 方法（前缀 BinaryReader_） ====================
/**
 * 初始化 BinaryReader 全局变量
 * @param {ArrayBuffer} arrayBuffer 二进制数据缓冲区
 */
function BinaryReader_init(arrayBuffer) {
    BR_data = new Uint8Array(arrayBuffer);
    BR_byteOffset = 0;
    BR_bitOffset = 0;
}

/**
 * 读取1个比特位
 * @returns {string} '0' 或 '1'
 */
function BinaryReader_readBit() {
    const byte = BR_data[BR_byteOffset];
    const bit = (byte >> (7 - BR_bitOffset)) & 1;
    
    BR_bitOffset++;
    if (BR_bitOffset >= 8) {
        BR_bitOffset = 0;
        BR_byteOffset++;
    }
    
    return String(bit);
}

/**
 * 读取指定数量的比特位并转换为整数（MSB优先）
 * @param {number} numBits 要读取的比特位数
 * @returns {number} 转换后的整数
 */
function BinaryReader_readBits(numBits) {
    let num = 0;
    for (let i = 0; i < numBits; i++) {
        num = num * 2 + +BinaryReader_readBit();
    }
    return num;
}

/**
 * 读取指定数量的比特位并转换为单精度浮点数（最后一位表示0或0.5）
 * @param {number} numBits 要读取的比特位数
 * @returns {number} 转换后的浮点数
 */
function BinaryReader_readBits2SingleFloatNumber(numBits) {
    const intPart = BinaryReader_readBits(numBits - 1);
    return intPart + (BinaryReader_readBit() === '1' ? 0.5 : 0);
}

/**
 * 读取指定数量的比特位并转换为四分之一步精度浮点数（最后两位表示 0, 0.25, 0.5, 0.75）
 * @param {number} numBits 要读取的比特位数
 * @returns {number} 转换后的浮点数
 */
function BinaryReader_readBits2QuarterFloatNumber(numBits) {
    const intPart = BinaryReader_readBits(numBits - 2);
    const frac = (BinaryReader_readBit() === '1' ? 2 : 0) + (BinaryReader_readBit() === '1' ? 1 : 0);
    return intPart + frac * 0.25;
}

// ==================== 关卡解析状态（前缀 LP_） ====================
let LP_scriptInstructionCount = 0;
let LP_currentScriptIndex = 0;

// ==================== 主解析函数 ====================
/**
 * 解析关卡二进制流并直接应用：地图写入 GAMEMAP_tileMapArray、物体创建陷阱
 * @param {ArrayBuffer} arrayBuffer 关卡二进制数据缓冲区
 * @returns {boolean} 解析是否成功
 */
function parseLevelBinaryStream(arrayBuffer) {
    BinaryReader_init(arrayBuffer);
        trapManagerClear();
        trapManagerInitializeTrapClasses();

        // 地图：基础值填充 + 矩形指令覆盖
        const mapBase = BinaryReader_readBit();
        const mapInstructionCount = BinaryReader_readBits(7);
        const mapWidth = 32;
        const mapHeight = 16;
        const mapArray = [];
        for (let y = 0; y < mapHeight; y++) {
            const row = [];
            for (let x = 0; x < mapWidth; x++) row.push(mapBase);
            mapArray.push(row);
        }
        for (let i = 0; i < mapInstructionCount; i++) {
            const type = BinaryReader_readBit();
            const startX = BinaryReader_readBits(5);
            const startY = BinaryReader_readBits(4);
            const endX = BinaryReader_readBits(5);
            const endY = BinaryReader_readBits(4);
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    if (y < mapHeight && x < mapWidth) mapArray[y][x] = type;
                }
            }
        }
        GAMEMAP_tileMapArray = mapArray;

        // 物体：边读边创建陷阱
        const objectCount = BinaryReader_readBits(7);
        for (let i = 0; i < objectCount; i++) {
            const objType = BinaryReader_readBits(4);
            const objIndex = BinaryReader_readBits(6);
            switch (objType) {
                case 0: // blackhole
                    createBlackHole(objIndex, BinaryReader_readBits(5), BinaryReader_readBits(4));
                    break;
                case 1: // floatrect
                    createFloatRect(objIndex, BinaryReader_readBits(5), BinaryReader_readBits(4), BinaryReader_readBits(6), BinaryReader_readBits(4));
                    break;
                case 2: // button
                    createButton(objIndex, BinaryReader_readBits(5), BinaryReader_readBits(4));
                    break;
                case 3: // bounce
                    createBounce(objIndex, BinaryReader_readBits(5), BinaryReader_readBits(4));
                    break;
                case 4: // destination
                    createDestination(objIndex, BinaryReader_readBits(5), BinaryReader_readBits(4));
                    break;
                case 5: // oneway — 只有宽度，高度固定1格
                    createOneway(objIndex, BinaryReader_readBits(5), BinaryReader_readBits(4), BinaryReader_readBits(6));
                    break;
            }
            // 所有类型末尾统一读取 hidden(1) + noCollision(1)
            const trap = TRAP_instances[objIndex];
            if (trap) {
                trap.h = BinaryReader_readBit() === '1';
                trap.n = BinaryReader_readBit() === '1';
            }
        }

        // 脚本指令数量
        LP_scriptInstructionCount = BinaryReader_readBits(7);
        LP_currentScriptIndex = 0;
        return true;
}
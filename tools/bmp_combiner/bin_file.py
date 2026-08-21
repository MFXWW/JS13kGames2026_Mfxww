def bin_str_to_bin_file(bin_str: str, file_path: str) -> None:
    """
    将0/1组成的字符串写入二进制文件（长度为8的倍数即可，256倍数自然满足）
    :param bin_str: 仅含0和1的字符串，长度为8的倍数（256倍数）
    :param file_path: 要写入的二进制文件路径（如'output.bin'）
    :raises ValueError: 输入字符串含非0/1字符或长度非8的倍数时抛出异常
    """
    # 校验1：仅包含0和1
    if not all(c in ('0', '1') for c in bin_str):
        raise ValueError("字符串必须仅由0和1组成")
    
    # 校验2：长度是8的倍数
    str_len = len(bin_str)
    if str_len % 8 != 0:
        raise ValueError(f"字符串长度{str_len}不是8的倍数，无法转换为完整字节")
    
    # 步骤1：按8位切分，得到所有8位二进制子串
    bin_parts = [bin_str[i:i+8] for i in range(0, str_len, 8)]
    
    # 步骤2：将每个8位二进制串转为十进制整数（0-255），再转为字节对象
    # int(二进制串, 2)：将二进制字符串转为十进制整数；bytes()将整数列表转为字节流
    byte_data = bytes(int(part, 2) for part in bin_parts)
    
    # 步骤3：以二进制写入模式（wb）写入文件，with自动管理文件关闭
    with open(file_path, 'wb') as f:
        f.write(byte_data)

def read_bin_file_to_bin_str(file_path: str) -> str:
    """读取二进制文件，转回0/1组成的字符串"""
    with open(file_path, 'rb') as f:
        byte_data = f.read()
    # 每个字节转8位二进制字符串（补前导0，确保固定8位）
    bin_str = ''.join(f"{byte:08b}" for byte in byte_data)
    return bin_str

if __name__ == "__main__":
    # 测试二进制字符串写入与读取
    test_bin_str = "01011001" * 32  # 32字节，256位
    test_file_path = "test.bin"
    bin_str_to_bin_file(test_bin_str, test_file_path)
    read_back = read_bin_file_to_bin_str(test_file_path)
    print(f"原始字符串: {test_bin_str}")
    print(f"读取后字符串: {read_back}")
    print(f"匹配: {test_bin_str == read_back}")
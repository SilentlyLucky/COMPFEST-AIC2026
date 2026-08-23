def hash_string(input_str: str) -> int:
    h = 0
    step = max(1, len(input_str) // 2000)
    for i in range(0, len(input_str), step):
        h = (h * 31 + ord(input_str[i])) & 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h)

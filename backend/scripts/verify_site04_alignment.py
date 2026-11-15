import struct, array, sys

base = r"C:\Users\KARTHIKEYAN S\AppData\Local\Temp"

def read_tif(path):
    d = open(path, "rb").read()
    e = "<" if d[:2] == b"II" else ">"
    p = struct.unpack_from(e+"I", d, 4)[0]
    n = struct.unpack_from(e+"H", d, p)[0]
    tags = {}

    for i in range(n):
        q = p+2+i*12
        tag, typ, count, val = struct.unpack_from(e+"HHII", d, q)
        if tag in (273,279,256,257):
            raw = d[q+8:q+8+4*count] if 4*count <= 4 else d[val:val+4*count]
            tags[tag] = struct.unpack(e+str(count)+"I", raw)

    a = array.array("f")
    for off,size in zip(tags[273],tags[279]):
        a.frombytes(d[off:off+size])
    if sys.byteorder != ("little" if e=="<" else "big"):
        a.byteswap()
    return tags,a

tags,ldec = read_tif(base+r"\Site04_ldec.tif")
W,H = tags[256][0],tags[257][0]

data = open(base+r"\Site04_final_adj.xyzi","rb").read()
sample = list(struct.iter_unpack("<4d",data))[::997]

for mode in ("centre","area"):
    direct = nearby = valid = 0

    for x,y,z,rdr in sample:
        px = (x*1000+9000)/5
        py = (1000-y*1000)/5
        col,row = (round(px),round(py)) if mode=="centre" else (int(px),int(py))

        if 0 <= row < H and 0 <= col < W:
            valid += 1
            direct += ldec[row*W+col] > 0
            nearby += any(
                ldec[r*W+c] > 0
                for r in range(max(0,row-1),min(H,row+2))
                for c in range(max(0,col-1),min(W,col+2))
            )

    print("\nConvention:",mode)
    print("Points inside:",valid)
    print("Direct LDEC matches:",direct)
    print("Nearby LDEC matches:",nearby)
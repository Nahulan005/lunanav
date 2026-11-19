"""Provision pinned official TIFFs during build; never rely on runtime uploads.

Run from repo root or backend: python <path>/provision_site04.py <directory>.
--verify-only checks existing files without network or mutations.
"""
import argparse
import hashlib
import os
from pathlib import Path
import sys
import time
from urllib.request import urlopen, Request

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.providers.site04_windows import PINS

SIZES = {"surf":40980806,"slp":40980772,"toterr":40980808,"slperr":40980806,"ldec":40980740}
BASE_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/"


def intact(path, key):
    if not path.is_file() or path.stat().st_size != SIZES[key]:
        return False
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()==PINS[key]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',type=Path)
    parser.add_argument('--verify-only',action='store_true')
    args=parser.parse_args()
    deadline=time.monotonic()+300
    if not args.verify_only:
        args.directory.mkdir(parents=True,exist_ok=True)
    for key in PINS:
        name=f'Site04_final_adj_5mpp_{key}.tif'
        target=args.directory/name
        if not intact(target,key):
            if args.verify_only:
                raise ValueError(f'Missing or invalid source: {name}')
            temporary=target.with_suffix('.tif.part')
            try:
                request=Request(BASE_URL+name,headers={'User-Agent':'LunaNav-Site04-build/1.0'})
                with urlopen(request,timeout=20) as response, temporary.open('wb') as output:
                    received=0
                    while True:
                        if time.monotonic()>deadline:
                            raise TimeoutError('Site04 provisioning exceeded 300 second total budget')
                        block=response.read(1024*1024)
                        if not block:
                            break
                        received+=len(block)
                        if received>SIZES[key]:
                            raise ValueError(f'Oversized source: {name}')
                        output.write(block)
                if not intact(temporary,key):
                    raise ValueError(f'Source size/SHA-256 mismatch: {name}')
                os.replace(temporary,target)
            finally:
                temporary.unlink(missing_ok=True)
        print(f'VERIFIED {name}: {SIZES[key]} bytes, SHA-256 {PINS[key]}',flush=True)
    print('All five Site04 products are ready. Set SITE04_DATA_DIR to this directory.')


if __name__=='__main__':
    main()

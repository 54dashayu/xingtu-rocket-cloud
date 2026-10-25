#!/usr/bin/env python3
"""Install pinned public xdb files; never uploads or queries visitor IPs."""
import argparse
import hashlib
from pathlib import Path
import urllib.request

REVISION = 'f8b0792b0cd729f5b2593f690aeed225e49c1967'
FILES = {
    'ip2region_v4.xdb': '27ecba8c9a6d5e3b280aedbe7ee15c65372b179fbd0dad3845d8c608f2fcace1',
    'ip2region_v6.xdb': '939f6b46bd2b8bec3cf7c5ceb8ba782266ae9b1f35b5ba7916700dec0b7506ed',
}

def install(directory):
    directory.mkdir(parents=True, exist_ok=True)
    for name, checksum in FILES.items():
        target = directory / name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == checksum:
            continue
        url = f'https://raw.githubusercontent.com/lionsoul2014/ip2region/{REVISION}/data/{name}'
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != checksum:
            raise ValueError(f'{name}: checksum mismatch')
        temp = target.with_suffix('.tmp')
        temp.write_bytes(data)
        temp.chmod(0o644)
        temp.replace(target)
    (directory / 'SOURCE.txt').write_text(f'ip2region https://github.com/lionsoul2014/ip2region\nCommit: {REVISION}\nInstalled snapshot: 2026-10-25 (not database record date)\n')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    install(parser.parse_args().directory)

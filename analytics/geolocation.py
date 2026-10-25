"""Offline IP region lookup. No visitor address ever leaves this service."""
from functools import lru_cache
import ipaddress
import os
from pathlib import Path
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parent / 'vendor'))
from ip2region import searcher, util

DB_DIR = Path(os.getenv('ANALYTICS_GEOIP_DIR', '/opt/xingtu-analytics/shared/geoip'))
UNKNOWN = '暂未识别'
COUNTRIES = {'US':'美国','GB':'英国','DE':'德国','FR':'法国','JP':'日本','KR':'韩国','SG':'新加坡',
             'AU':'澳大利亚','CA':'加拿大','RU':'俄罗斯','IN':'印度','NL':'荷兰','CN':'中国'}


def region_label(raw):
    # Pinned xdb format: country|province|city|ISP|ISO alpha2.
    fields = raw.split('|')
    if len(fields) != 5:
        return UNKNOWN
    country, province, city, _, iso = fields
    country = COUNTRIES.get(iso.upper(), country)
    parts = []
    for part in (country, province, city):
        part = part.strip()
        if part and part not in ('0', '-', 'null', 'None') and part not in parts:
            parts.append(part)
    return ' · '.join(parts) or UNKNOWN


class GeoLocator:
    def __init__(self, directory=DB_DIR):
        self.directory = Path(directory)
        self.readers = {}
        self.lock = threading.Lock()

    def _search(self, address):
        # Shared seek-based readers are serialized; two vector indexes use ~1 MiB.
        with self.lock:
            version = address.version
            if version not in self.readers:
                path = str(self.directory / f'ip2region_v{version}.xdb')
                with open(path, 'rb') as handle:
                    util.verify(handle)
                self.readers[version] = searcher.new_with_vector_index(
                    util.IPv4 if version == 4 else util.IPv6,
                    path, util.load_vector_index_from_file(path))
            return self.readers[version].search(str(address))

    @lru_cache(maxsize=8192)
    def lookup(self, value):
        try:
            address = ipaddress.ip_address(value)
            if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
                address = address.ipv4_mapped
            if address.is_loopback:
                return '本机地址'
            if address.is_private:
                return '内网或保留地址'
            if not address.is_global or address.is_multicast:
                return '非公网地址'
            try:
                return region_label(self._search(address))
            except Exception:
                # A missing/incompatible/corrupt optional database must not break stats.
                return UNKNOWN
        except (ValueError, OSError, IndexError):
            return UNKNOWN

    def close(self):
        with self.lock:
            for reader in self.readers.values():
                reader.close()
            self.readers.clear()
        self.lookup.cache_clear()


locator = GeoLocator()

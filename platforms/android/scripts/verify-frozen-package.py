"""Verify frozen public assets and packaged Android adaptation, without writes."""
import hashlib,json,sys,zipfile
from pathlib import Path
manifest,apk=map(Path,sys.argv[1:3])
root=Path(__file__).resolve().parents[3]
platform=Path(__file__).resolve().parents[1]
m=json.loads(manifest.read_text())
assert m['status']=='frozen', 'Shared assets not frozen'
z=zipfile.ZipFile(apk)
for f in m['files']:
    path=f['path']; source=(root/path).read_bytes()
    assert hashlib.sha256(source).hexdigest()==f['sha256'],path
    name=path.removeprefix('public/')
    expected=(platform/'www/index.html').read_bytes() if name=='index.html' else source
    assert z.read('assets/public/'+name)==expected, name
print(json.dumps({'build':m['build'],'assets':len(m['files']),'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'status':'passed'},indent=2))

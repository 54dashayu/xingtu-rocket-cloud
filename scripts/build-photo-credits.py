"""Create attributed derivatives from checked-in, licensed editorial photos."""
import json, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'analytics'))
from photo_credit import credit_image
records=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {archiveMedia} from './public/map/archive-media.js'; console.log(JSON.stringify(archiveMedia))"],cwd=root))
for record in records:
    for photo in record['photos']:
        if not photo.get('file'):continue
        original=photo.get('originalFile',photo['file'])
        source=root/'public/map/media'/original
        target=source.with_name(source.stem+'-credited.jpg')
        target.write_bytes(credit_image(source.read_bytes(),photo['credit'],photo['source']))
        print(target.name)
